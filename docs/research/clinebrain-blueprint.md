# ClineBrain Tauri 세컨드 브레인 구현 설계

첫 제품은 macOS에서 로컬 Markdown 폴더를 열고, 근거가 있는 AI 제안을 검토해 memory/wiki로 확정하고, 다음 질문에서 그 지식을 다시 사용하는 앱으로 정의한다. 아래는 Kuku 분석에서 도출한 제안이며 이미 구현된 기능은 아니다.

## 최소 사용자 흐름

1. 폴더를 선택하고 원본 노트를 작성하거나 가져온다.
2. 노트 또는 선택 영역에서 “기억으로 제안”을 실행한다.
3. AI가 후보 기억과 출처를 반환한다.
4. 사용자가 근거·변경 내용·기존 기억과의 충돌을 보고 채택, 거절, 수정 요청을 선택한다.
5. 앱이 승인한 revision을 디스크에 반영한다.
6. 앱을 종료하고 다시 열어도 기억과 판단 기록이 남는다.
7. 새 질문에서 관련된 활성 기억을 검색하고, 답변과 함께 출처를 보여 준다.

이 흐름이 통과하기 전까지 3D 그래프와 클라우드 계정은 필수 기능이 아니다. 먼저 확인할 제품 가치는 “저장한 지식이 다음 작업의 판단을 실제로 개선하는가”다.

## 권장 코드 경계

```text
apps/desktop/
  src/
    app/                 창과 레이아웃
    features/editor/     문서 세션과 편집 UI
    features/knowledge/  제안 검토와 출처 UI
    features/search/     검색과 관련 문서
    features/chat/       질문과 context 표시
    services/            타입이 있는 IPC client
  src-tauri/
    src/commands/        얇은 IPC adapter
    src/runtime/         상태와 작업 수명
    src/platform/        Keychain과 OS 기능
crates/
  brain-core/            모델과 검증과 제안 상태 머신
  brain-vault/           경로와 안전한 파일 쓰기와 복구
  brain-index/           Markdown 파싱과 SQLite 인덱스
  brain-ai/              provider와 도구와 context 구성
```

Tauri의 AppHandle에 의존하는 코드는 adapter/runtime에 모으고, 핵심 모델·검증·검색은 가능한 한 UI 없이 테스트할 수 있게 한다. Kuku의 `*_for_root` 함수 분리를 참고하되 코어 crate에 Tauri 의존성이 번지지 않게 한다.

프런트엔드는 Kuku 재사용량이 많으면 SolidJS가 자연스럽다. 새로 구현하면서 React 경험이 더 많다면 React도 가능하지만 에디터 node view와 반응형 상태를 변환하는 비용을 고려해야 한다. 이 설계의 핵심은 프레임워크보다 저장과 승인 계약이다.

## 데이터 원칙

사용자 Markdown과 frontmatter를 원본으로 한다. SQLite는 검색·링크·stale 상태 등 재구성 가능한 파생 데이터다. 저널은 작업 중 복구를 위한 상태이고, 확정 판단 기록은 사용자가 보관할 수 있는 문서로 남긴다.

| 모델 | 최소 필드 |
| --- | --- |
| Note | id, path, title, revision, checksum, body |
| Memory | id, kind, title, body, status, source_refs, decision_id, timestamps |
| WikiPage | id, page_type, title, body, status, source_refs, timestamps |
| Proposal | id, base_revisions, changes, sources, created_at |
| Decision | id, proposal_id, proposal_revision, choices, actor, applied_at |
| SourceRef | note_id, path_snapshot, checksum, section, optional range |

모든 모델의 저장 형식에 schema_version을 둔다.IDはタイトル変更で変わらないものにする。pathは移動するため識別子と分離する。SourceRefは行番号だけでなく原文 checksum と節情報を持たせ、原本変更時に「根拠が更新された」ことを表示する。

memoryのscopeは project / global などを将来追加できるようにする。ただし初期から複雑な権限モデルを作る必要はない。active / archived / superseded は検索条件として実際に使用する。古い判断の履歴と現在採用している判断を混ぜない。

## 書き込みと承認の契約

UIの承認対象は単なる proposal IDではなく、**proposal IDとrevisionと対象ファイルのbase revision**の組で固定する。AIが提案を書き換えた場合は旧承認を使えないようにする。

```text
draft → pending → applied
                → partially_applied
                → needs_revision
                → rejected
```

これはClineBrain用の状態案である。Kukuでは全件noもappliedになるが、ユーザー表示を分かりやすくするため、全件拒否をrejectedとして区別する。文書全体の状態とは別に、各変更の結果を保持する。

適用処理は、入力検証 → ロック → revision再確認 → staging → journal永続化 → 対象反映 → decision保存 → index更新要求 → cleanupとする。保存済みだがindex更新に失敗した場合は「保存失敗」と同じ扱いにしない。再試行で二重適用しないよう request ID を使用する。

テキスト書き込みはファイル単位で直列化する。複数ファイルの処理はジャーナルと復旧方針を持たせ、外部変更がある場合は両方の内容を残す。データベースとファイルを一つの原子的transactionとして扱わず、ファイルの確定後にインデックスを追随させる。

## 最初のIPC契約案

| コマンド | 入力の要点 | 出力の要点 |
| --- | --- | --- |
| vault_open | directory | vault_id, generation |
| note_read | vault_id, note_id/path | content, revision |
| note_save | vault_id, path, base_revision, content | saved/conflict, revision |
| knowledge_propose | sources, candidate changes | proposal_id, revision |
| knowledge_review | proposal_id, revision, choices | reviewed revision |
| knowledge_apply | reviewed revision, request_id | per-change outcomes, recovery state |
| knowledge_search | query, kinds, status, limit | evidence-bearing hits |
| knowledge_context | query, active_note, budget | selected context and citations |
| index_status | vault_id | indexed/pending/error |

Rust/TypeScriptの型は自動生成か契約テストで同期する。すべてのIPC errorを文字列だけにせず、DOCUMENT_CHANGED、UNSAFE_PATH、VALIDATION_FAILED、RECOVERY_REQUIRED等の機械判定できるcodeを持たせる。

## 検索とcontext生成

初期版はSQLiteの全文検索とmetadata検索で作り、Knowledgeも同じ増分更新系に載せる。自然文をそのままcontainsに渡さず、検索用語への分解と適切なAND/ORの切り替えを行う。原文、memory、wikiを区別した検索結果を返す。

context builderの順序は次の通り。

1. activeかつ対象scopeに合う候補を検索する。
2. active note、タグ、明示リンクなどで候補を補助する。
3. 同じ根拠の重複候補をまとめる。
4. staleな根拠や相反する記憶を識別して表示する。
5. 統合token budget内で内容を選ぶ。
6. モデルに渡した項目と出典を記録する。

embeddingは検索評価を作ってから追加する。追加時はchunk hash、embedding model/version、失敗再試行、再生成、削除時の除去を管理する。評価で改善を確認せずベクトルDBだけを先に導入しない。

## 実装順と完了条件

| 段階 | 作るもの | 完了条件 |
| --- | --- | --- |
| 1 | Tauri shell、vault open、読込・保存、外部変更検知 | 外部編集後の古い保存が衝突になり、再起動後も内容が残る |
| 2 | Markdown extraction、増分SQLite検索、wikilink/backlinks | 追加・削除・renameが検索とリンクへ反映し、DB削除から再構築できる |
| 3 | memory/wikiモデル、proposal、review、apply、journal | yes/no/otherと既存wiki更新が動き、途中終了から回復できる |
| 4 | AI provider 1種類、検索・提案tool、context builder | 提案だけでは確定せず、次の別セッションで採用済み知識を再利用できる |
| 5 | ウィンドウ挙動、Keychain、CSP、署名・更新 | 実際のapp/dmgで新規インストールと更新を確認できる |
| 6 | 必要に応じたsync、追加provider、可視化 | コアのデータ保全テストを維持したまま拡張できる |

## 必須テストシナリオ

- **保存競合**: Aを開いた後、外部エディタでBへ変更。A由来の保存でBを失わない。
- **watcher**: atomic save、重複イベント、ディレクトリrename、大量更新後に最終状態が一致する。
- **vault切替**: 旧vaultの検索・AIイベントが新vaultに反映されない。
- **承認改変**: 検討後にproposalを書き換えると旧revisionのApplyが拒否される。
- **判断の組合せ**: 全yes、全no、yes+other、未選択、空otherを区別できる。
- **二重適用**: 同一requestを再送してもmemoryが重複しない。
- **障害注入**: stage後、1ファイル反映後、decision保存前、cleanup前に停止し、再起動で回復する。
- **根拠変更**: sourceを変更・移動・削除すると古い根拠を最新として表示しない。
- **非アクティブ記憶**: archived/supersededは通常contextから除外し、履歴検索では見つかる。
- **한국어·일본어·영어**: 短語、長文質問、表記揺れ、分解Unicodeを含む検索で評価する。
- **権限境界**: traversal、symlink、HTML/リンク経由の不正動作、AIの直接確定操作を拒否する。
- **ネイティブ実行**: ウィンドウを閉じる、再表示する、終了する、Keychain失敗、ネット切断、update失敗を確認する。

検索評価には実データ相当の質問と期待する出典を固定したセットを用意する。Recall@k、根拠の正確さ、古い記憶の混入、p95検索時間を測る。目標値はデータ規模と実機測定後に決め、推定値を性能保証にしない。

## 実装開始時の判断

最初に着手する対象は **Tauri上で安全に開く・保存する・外部変更を扱う縦の一連の機能**。その上にKnowledgeの提案とApplyを載せる。Kuku全体をforkする場合でも、まず独自bundle ID・データroot・Keychain名・更新先を設定し、必要機能とネイティブ依存関係を明示する。

この設計ではAI providerとUIフレームワークは交換可能だが、Markdown原本、安定ID、revision、出典、判断履歴、復旧可能な保存は初期から固定すべき基盤になる。
