# ClineBrain project conventions

ClineBrain is a macOS desktop workspace for builders. Keep recommendations small and testable. We use Tauri 2, React, TypeScript, and a Node 22 worker. User memories are local Markdown; SQLite holds search and run records.

Our key constraint: agents may draft, but GitHub publication requires an explicit review of the exact response and destination. Never automatically resend an ambiguous write. Prefer one end-to-end workflow over a broad set of unfinished integrations.

한국어로 입력한 프로젝트 메모도 동일한 공유 기억으로 사용한다. 제안 상태의 기억은 사용자가 채택하기 전까지 다음 작업의 맥락에 포함하지 않는다.
