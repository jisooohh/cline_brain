# ClineBrain — 다른 컴퓨터에서 이어하기

## 시작

1. 이 압축을 풀고 `ClineBrain/source`를 Codex의 프로젝트로 연다.
2. Node.js 22 이상, Rust stable, Xcode Command Line Tools를 설치한다.
3. `npm ci` → `npm test` → `npm run desktop`.
4. 배포 앱 생성: `npm run bundle`.
5. Codex CLI는 새 컴퓨터에서 별도로 설치·로그인하고 Connections에서 절대 경로를 설정한다.

`macOS-AppleSilicon/ClineBrain.app`은 현재 빌드(arm64)다. Intel Mac에서는 소스로 다시 빌드한다. 현재 앱은 공증되지 않은 개발 빌드다.

## 기존 문서·기억·실행 기록 가져오기 (선택)

앱을 완전히 종료한 뒤 `workspace-data`의 `brain.sqlite`와 `brain` 폴더를 새 Mac의
`~/Library/Application Support/ai.clinebrain.desktop/`에 복사한다.
기존 데이터가 있는 컴퓨터에서는 먼저 해당 폴더를 백업하고 덮어쓴다.
SQLite는 온라인 백업 API로 일관된 스냅샷을 만들었으며, Markdown 파일도 함께 포함했다.
설정에 남은 이전 컴퓨터의 Codex 실행 경로는 Connections에서 수정해야 한다.
예약은 앱을 실행할 때 동작한다. 복원 전에 저장된 자동화를 확인한다.

API 키, macOS Keychain, Codex 인증, 터미널 세션은 포함하지 않았다.
새 Mac에서는 서비스 키 및 필요한 GitHub 연결을 Connections에서 확인한다.

## 현재 구현

- Tauri 2 + React/TypeScript + Vite, Rust 네이티브 계층, Node 22 워커.
- 문서 중심 Kuku 편집기 포트, 그래프 원본 타입/레이아웃/CSS/라벨 선택 코드 재사용.
- 그래프에 읽은 기억 → 결과 문서 provenance, 직접 이웃 강조, 원본 revision 표시.
- 실제 PTY 터미널, 병렬 서브에이전트, 로컬 Codex 리드, 결과 Markdown 저장.
- 키캡 클릭 → 담당 작업·상태·답변 카드. 작업 중 모델 색상, 완료 회색 + Done, 실패 빨강.
- 기본 Cline 팀: DeepSeek V4.1 Flash / Qwen3.8 Flash / Gemini3.5 Flash-Lite /
  Amazon Nova2 Lite / MiniMax M3 / GLM5.3 Flash. Codex 리드는 gpt-6-luna.
- 모델 카탈로그: `shared/budget-models.json`. 가격은 카탈로그 추정치다.
- 429 오류는 2초, 5초 간격으로 두 번 재시도하며 취소가 가능하다.

## 가장 먼저 이어서 할 작업 — 아직 미해결

사용자 요청: **재시작 시 이미 저장한 Cline 키가 로드되지 않는 문제를 고치고,
Nova가 포함된 팀이 실제 결과 문서를 저장할 때까지 검증하기.**

직후 사용자가 다른 컴퓨터에서 이어가기 위한 압축을 요청하여 현재 상태를 인계한다.
이 버그는 아직 수정 완료하지 않았고 Nova 실호출도 아직 성공 검증하지 않았다.

확인된 증거:
- 이전 빌드에서는 Cline 키로 여러 모델이 실제 응답했다.
- 현재 Mac의 Keychain에서 service `ai.clinebrain.desktop`, account `cline`
  항목이 존재함을 비밀값 출력 없이 확인했다 (`security find-generic-password` exit 0).
- 최근 재시작 후 `document.start`는 `Save your Cline API key in Connections first.` 반환.
- `src-tauri/src/main.rs`의 `secrets()`는 모든 Keychain 읽기 오류를 조용히 무시한다.
- `launch()`는 비동기 `init` 요청 결과도 무시한다. 초기화 완료 gate가 없다.
- `credential_status()`는 Keychain을 재조회하지만 워커의 secrets를 갱신하지 않는다.
- `worker/index.mjs`의 `init`는 `engine.secrets` 전체를 교체한다.

권장 조사/수정:
1. 키 값은 출력하지 말고 Keychain의 NoEntry/접근 거부/잠금 오류를 구분한다.
2. 앱 재빌드 시 ad-hoc 서명 변경으로 인한 Keychain 접근 문제인지 확인한다.
   OS 보안 승인창은 사용자가 직접 처리하며 접근 보호를 우회하지 않는다.
3. Keychain I/O를 blocking thread에서 실행하고 초기화 순서를 보장한다.
   로딩 실패가 빈 secrets로 조용히 확정되지 않도록 한다.
4. 저장·재로드·작업 시작 사이의 race를 막고 안전한 재시도/상태 안내를 추가한다.
5. 재시작 후 키 복원, Nova 단독/혼합 팀 실제 응답, Codex 종합 및 Markdown 저장을 확인한다.

## 최근 검증

- `npm test`: 32/32 통과.
- `npm run bundle`: macOS .app 빌드 성공.
- 실제 응답 확인: DeepSeek, Qwen, Gemini3.5 Flash-Lite, MiniMax M3, GLM5.3 Flash.
- Mistral은 upstream shared pool 429가 반복되어 **Amazon Nova2 Lite로 교체**했다.
- Nova의 Cline 카탈로그 지원은 확인했으나 실제 호출은 키 로딩 단계에서 차단됐다.
- 이전 실패 기록은 정확성을 위해 그대로 보존했다. 과거 기록에 Mistral이 보이는 것은 정상이다.
- 자세한 실행 ID와 증거는 `docs/verification-workspace.md` 참조.

## 주의할 구현 특성

- 실행 중인 앱의 데이터 경로로 worker `Store`를 새로 생성하지 말 것:
  생성자가 실행 중 상태를 interrupted로 복구한다. 조사에는 SQLite readOnly를 사용한다.
- 새 결과가 도착해도 사용자 문서/선택 작업을 강제로 바꾸지 않는다.
- 제안/보관 기억은 일반 에이전트 맥락에서 제외한다.
- 키는 Keychain만 사용한다. 저장소·문서·채팅·로그에 넣지 않는다.
- 원본 프로젝트는 Git 저장소가 아니다. 필요하면 새 컴퓨터에서 초기화한다.
- Kuku 원본 전체 체크아웃은 포함하지 않았다. 앱이 사용하는 포트와 라이선스는 모두 포함했다.
