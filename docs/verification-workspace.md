# Native workspace verification — 2026-10-19

## Automated checks

- `npm test`: 10 workflow/storage tests passed.
- `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests -- --nocapture`: real PTY test passed (TTY detection, `/tmp` working directory, Korean Unicode, 27 × 91 terminal size).
- TypeScript + Vite + bundled Node worker build passed.
- Release macOS `.app` built successfully with native PTY commands.

## Native UI checks

Launched `src-tauri/target/release/bundle/macos/ClineBrain.app` as a native app, not a browser preview.

- Sidebar contains Second Brain, Active AI, Automations, Connections and actual saved memory.
- Previously saved Korean project memory restored after app restart.
- Terminal ran `cd /tmp`, `printf` with Korean text, `pwd`, and `stty size`; visible output confirmed real shell state and dimensions.
- `sleep 30` was interrupted with Ctrl+C; subsequent `printf 'CTRL_C_OK\n'` succeeded.
- ⌘J hid and restored the same shell session.
- New terminal button opened a second shell tab.

## Scope

The PTY is user-operated and separate from the read-only agent execution workflow. Tabs are killed when closed or when the app exits. Shell sessions do not persist across app restarts. API-backed Cline/Parallel/Composio completion is not established by these workspace checks.

Kuku source reuse is itemized in `THIRD_PARTY_NOTICES.md`. The default center view is a Markdown document workspace; the original Exawatt renderer is retained in the Workspace tab.

## Document workspace UI verification

- Latest release opens directly to a saved document in Second Brain.
- Created `Your workspace, connected` through the native editor with headings, bullets, a code block and Korean blockquote.
- Save changed the status from Unsaved changes to Saved locally and increased the sidebar memory count to 2.
- Read mode rendered Markdown headings, lists, blockquote and code; both documents remained open in central tabs.
- The bottom terminal simultaneously executed `pwd` and `node --version` (v22.23.0) and displayed Korean output.
- Final native screenshot: `docs/screenshots/native-documents-terminal.png`.

## Real Codex document workflow

- Release app rebuilt and launched with Active AI → Work with Codex.
- Selected the currently open `Your workspace, connected` document.
- Submitted a Korean instruction to write a one-minute demo script using that document and active memories.
- Native UI showed actual CLI session connected, drafting, and completed events.
- Run `40caa7a0-c88f-4308-a37d-472737462d32` completed using 2 active memories: `Your workspace, connected` and `ClineBrain project conventions`.
- Result `8106479d-a25d-47cb-804d-ff8c7c7ca936` saved to Markdown as `Codex · Your workspace, connected`, Suggested status, with source run linkage.
- Open result document displayed the real 159-word Korean Markdown response and cited both memory titles.
- Source documents remained intact. Result is excluded from ordinary context until explicitly activated.
- Added tests for draft context, project/status isolation, single-workflow guard, failed/cancelled tasks and result persistence: `npm test` now passes 12 tests.
- Native screenshot: `docs/screenshots/native-codex-document-result.png`.

## Kuku editor and compact activity inspector

- Ported Kuku's actual ProseKit core, Markdown roundtrip, CodeMirror node view, task/table/wiki nodes and slash commands; retained source attribution.
- Native editor verification: slash menu → Heading 1, typed heading and Korean paragraph, automatic save confirmed `Saved locally`.
- `node scripts/test-kuku.mjs`: 2 passed; `npm test`: 12 passed.
- Removed the large decorative Exawatt collection from Home. Right-hand inspector uses seven matte hex cells, only the actual running workflow creates an agent token; idle has none. Document outline and backlinks share this rail.
- Agent status, task, document count, memory count and latest event are read from the same persisted run as the task UI. Unsupported provider tokens are no longer shown as activity.
- Native run: started a real authenticated Codex document task from `Kuku workspace check`; right rail changed Idle → Working, showed Codex token, `1 document · 3 memories`, session-connected then working events. Switching back to Second Brain retained the live monitor.
- Screenshot: `docs/screenshots/native-kuku-live-agent.png`.
- Native ⌘P search opened `Your workspace, connected`; original Kuku rich headings/lists/blockquote/CodeMirror content rendered and right-side outline followed the selected document.
- Actual Codex task completed successfully, produced `Codex · Kuku workspace check` (541 words, Korean) as a suggested document. Open result rendered in the Kuku editor; monitor returned to Idle with no agent token. Result remains excluded from active context until adoption.

## Inline Codex workspace (2026-10-19)

The right Active AI inspector now owns the Codex composer, execution/cancel controls, exact input context, event history, and a scrollable rendered Markdown result. Submitting or selecting the 3D token does not navigate away from the current document. Results are still saved as suggested documents; opening one centrally is explicit. The active document snapshot includes unsaved changes, and only active project memories join it. A synchronous submit guard prevents repeated keyboard submissions while the start request is pending; the worker still enforces one workflow.

Validation: TypeScript production build and 12 worker tests passed. Native interaction evidence is recorded below.
- Native `.app` test: kept `Your workspace, connected` open in Second Brain, entered a Korean three-bullet summary request in the right inspector and pressed ⌘Enter. Codex ran against that document + 3 active memories. The right panel showed Working/session/progress, then completed and `Result Saved · proposed` with the real Korean result. The central document and workspace tab did not change. Screenshot: `docs/screenshots/native-inline-codex-result.png`.

## Concurrent Luna teams (2026-10-19)

- Default: GPT-6 Luna, 3 independent specialist sessions + a lead that synthesizes their returned reports. Solo and 1–6 specialists selectable. Up to 8 workflows with a shared FIFO budget of 6 Codex processes. Per-run cancellation and per-child cancellation have distinct scopes. Failed children preserve partial reports and block false combined success.
- Tests: existing 12 plus 4 team tests passed (overlap, 6-slot limit, exact shared context isolation, distinct session IDs, synthesis inputs, queued cancellation, running-child cancellation, sibling survival, partial failure, restart recovery).
- Real native verification: launched two teams without changing the open source document. Observed 6 Luna CLI sessions working concurrently. Both leads subsequently synthesized their own reports and saved proposed documents. All 8 real sessions completed. Structured evidence: `docs/luna-team-verification.json`.
- UI evidence: `docs/screenshots/native-luna-parallel-teams.png`, `docs/screenshots/native-luna-team-results.png`.
- Parallel and Composio setup dashboards opened. Parallel existing key stored directly via native password field into Keychain, never written to repository or chat. Composio project key was created after explicit approval and saved in macOS Keychain.

## Live service connections (2026-10-19)

- Parallel Search verified with a real request returning official Tauri documentation. Updated max_results to the API advanced_settings contract and added a regression test.
- Composio managed GitHub auth configured for public_repo and read:user. User approved connection; hosted flow confirmed Successfully connected. No organization grants requested.
- Native Connections → Check connections returned GitHub Connected as bigmacfive and Parallel Search API verified with a live request. Credentials remain in macOS Keychain.
- Cline provider API key is still absent; its orchestration flow is not yet verified. Codex teams operate independently.
- Full worker suite: 17 passed, 0 failed.
- OAuth success screenshot: docs/screenshots/github-composio-connected.png.

## Document workspace polish (2026-10-19)

- Removed duplicate top-level tabs. Added a persistent 320–560px inspector (380px default), Agents/Document tabs, fixed composer, collapsible configuration and terminal expansion. Inspector switches to an explicitly opened overlay when the document would have less than 560px.
- Original Exawatt geometry retained; larger 220/360px studio, selected agent highlighting, spring press/release, distinct status colors, completion impulse, hidden-canvas suspension and reduced-motion behavior.
- Shared minimal custom listbox replaces provider/model/team/memory dropdowns; keyboard arrows/Enter/Escape, selected option, focus return and outside dismissal implemented. Compact inputs and thin scrollbars.
- Browser checks at 1280×800, 1440×900 and 1000×720: keyboard model selection, responsive overlay, panel/tab switches preserve Korean instruction draft. Native window was 1440×940; exact native window resizing was not available through the attempted window-edge interaction. Native split resizing nevertheless verified the same overlay threshold, including manual open and restore.
- Two real native Luna teams completed: 3adeeb93-9558-4c96-aa0c-bb16ca68b80b and 6351367b-5f71-42de-acd9-1e63dd951dae. Both saved proposed documents without navigating away from the source.
- Native individual cancellation: selected Context analyst through the keycap legend, clicked Stop subagent, observed cancelled while siblings continued.
- Native terminal ran printf CLINEBRAIN_PANEL_OK; output survived expand, restore, hide and reopen.
- Evidence: screenshots/native-agent-studio.jpg, screenshots/native-overlay.jpg, screenshots/native-keycap-motion.mp4 (12 native screenshot frames, approximately 10fps).
- Full worker suite: 17 passed. Final production app build succeeded (29.12 MiB).
- Cline user-supplied key saved through native password field to Keychain; provider set to cline and SDK default model anthropic/claude-sonnet-5.5. Direct official SDK inference with the user-provided key returned completed/CLINE_READY. Native worker credential reload still awaits macOS access approval for the rebuilt app. Parallel and Composio credentials were not replaced.

- Cancellation test finished with root failed, lead blocked, selected child cancelled, other children completed, and no successful result document saved.

## Native Cline → Parallel → Codex completion (2026-10-19)

- After user allowed Keychain access, native app run `088b09f9-44ad-4142-b027-759a0b455b42` read the existing demo issue through Composio, loaded 3 active project memories, ran Cline research orchestration, attached 5 Parallel sources, handed the same context to the real Codex CLI, and reached `review`.
- Persisted proposed document `3a66530a-c94b-4816-85f4-938375d9642d` in SQLite and the app-managed `brain/3a66530a-c94b-4816-85f4-938375d9642d.md`. Native editor displayed its summary, root cause, proposed fix, test plan and sources. It remained readable after restarting the app. No comment was published and no memory was auto-adopted.
- Evidence: screenshots/native-cline-research-complete.jpg and screenshots/native-cline-result-document.jpg.
- Fixed Workspace recent activity dereferencing `run.issue` for document runs; mixed histories now open without a blank screen.

## Second Brain graph

- Project-scoped saved document graph; actual wiki-link resolution, alias/heading/.md normalization, reciprocal deduplication, no fabricated links for duplicate or missing targets. Literal code examples are excluded.
- React host keeps the editor mounted when graph is visible. Search, status legend, archived toggle, pan, zoom/reset and keyboard-operable document nodes.
- User requested Kuku reuse: imported original graph types, spacing rules and Quiet Constellation CSS; extracted Kuku's deterministic cluster layout and adapted its cursor-anchored wheel zoom. Full Pixi/3D canvas is not imported.
- Native initial dataset: 14 documents, zero wiki edges (honest disconnected view). Search ClineBrain reduced to one document; zoom displayed 120%.
- Four graph model tests plus existing 17 worker tests. Actual linked-edge parsing and project isolation verified with fixtures, without altering user notes.
- Final Kuku-port production bundle passed and launched natively. Wheel zoom changed 100% → 84%, reset returned 100%; node opening returned to the saved editor. Final native screenshot: screenshots/native-kuku-brain-graph.jpg. Test suite: 21/21 passed.

## Agent provenance graph (2026-10-19)

- Graph now includes directional context edges from each run's immutable `context` memory snapshots and `document` input to its persisted `memoryId` result. Requires matching result `runId`, same project, and existing source/result documents. No result means no fabricated output edge.
- Captured revisions, input role (memory/document), and unsaved-draft flag stay attached to the edge. Duplicate roles are collapsed while distinct memory/document evidence is retained. Current archived status does not erase historical usage; archived nodes remain behind the existing visibility toggle.
- Dashed arrows distinguish agent provenance from wiki links; keyboard/click connection details expose the original task. Canvas text is non-selectable and non-draggable, with browser drag payload prevention; editor text remains editable/selectable.
- Read-only check of real SQLite data: 14 nodes, 34 context edges; 3 incoming captured-memory edges to the completed Cline/Parallel/Codex result `3a66530a-c94b-4816-85f4-938375d9642d`.
- 24 tests passed (17 worker + 7 graph), including historical revision fidelity, dirty document inputs, cross-project exclusion, missing/mismatched result ownership, and dual-role deduplication.
- Corrected Cline branding: sidebar, workflow panels, connection setup and shared 3D registry now use the official Cline bot geometry, not Claude's star. Configured model stays independently labeled; future Claude Code entry retains its proper identity.
- Native final build displayed `14 documents · 34 links`. Clicking the ClineBrain conventions → demo result edge opened the evidence panel with captured revision `eed7811a41eb453a3911` and source-task control. Sidebar showed the Cline bot icon with model named separately. Screenshot: screenshots/native-context-graph.jpg.

## Tab strip and graph search cleanup (2026-10-19)

- Isolated the scrollable document tabs from fixed New/Graph actions. Native horizontal scrollbar hidden; compact left/right buttons appear only on overflow with disabled endpoint states. Trackpad scrolling and tab reordering remain available; selecting/opening a document reveals its tab.
- Graph search now uses one compact bordered container with its icon inside, explicit input reset, and wrapping header layout. Removed sticky Graph overlap and added a text backing stroke so edges do not cut through graph labels.
- Native interaction check: custom right button scrolled the tab viewport and enabled the left control; graph search for ClineBrain returned one matching document. Sidebar search received the same compact container/input reset. Graph label placement now tries alternate vertical offsets and rejects collisions with other nodes and labels.

## Budget mix and graph context — 2026-10-19

- Production macOS bundle built successfully; all 30 tests passed.
- Native run `0ad2c9b2-9c5c-4ecc-86a0-8a919fab4462` completed: three actual Cline gateway workers (`deepseek/deepseek-v4.1-flash`, `qwen/qwen3.8-flash`, `google/gemini-2.5-flash-lite`) followed by local `gpt-6-luna` synthesis. Each worker completed with text.
- Result `6f6a72e0-167b-4a9d-b145-bf153f64dfe5` saved as proposed Markdown. Current document plus three active memories were supplied. No external posting. Mistral is selectable but not live-tested.
- During execution, Graph remained open and selected context stayed selected when the new result arrived (16 documents / 40 links). Clicking a result highlighted its three source memories; the context panel displayed its complete long title. Vendor logos rendered on actual 3D keycaps.
- Screenshot: `screenshots/native-budget-mix-graph.jpg`.

## Keycap inspection and model pigments — 2026-10-19

- Added a selected-agent card immediately below the board: actual assigned role/task, user request, latest node event, returned Markdown and errors. Selecting a keycap brings this card into view without navigating documents. The same controls work through keyboard-accessible legend buttons.
- Model pigments persist through normal lifecycle states; failures remain red and all states retain text indicators. DeepSeek blue, Qwen purple, Gemini teal, Mistral orange, Codex sage.
- Copied Kuku's `graph_constellation.ts` unchanged and wired its focus-first hub label selection into the existing graph adapter. Existing Kuku layout/types/CSS remain in use; application storage and provenance are still ClineBrain adapters, not a whole Kuku app fork.
- Tests: 30/30 passed. Production Tauri bundle built successfully.
- Native inspection confirmed Qwen's selected card shows the exact assigned writing task and its returned Korean response while the source document remains open. During a user-launched six-worker run, all model-colored keycaps rendered and completed child answers remained readable before lead synthesis.
- Follow-up: default UI team now uses six distinct catalog models, with Gemini upgraded to 3.5 Flash-Lite and MiniMax M3 / GLM 5.3 Flash added. Completion badge is a model-colored check plus Done, with a short one-time appearance (disabled for reduced motion). These newer model endpoints require separate live verification; prior successful run used Gemini 2.5.

### Six-model execution and rate-limit handling
- User-launched native run `e853e625-d651-4ef2-b047-b07f2c29fd3f` verified actual responses from DeepSeek V4.1 Flash, Qwen3.8 Flash, Gemini 3.5 Flash-Lite, MiniMax M3, and GLM 5.3 Flash. Mistral Small 4 returned upstream shared-pool HTTP 429; synthesis correctly stayed blocked and the run failed.
- Added bounded Cline 429 retries (2s then 5s), visible retry activity, cancellation during backoff, and a concise exhausted-retry error. No model substitution or false success. Tests cover recovery, exhaustion, and cancellation: 32/32 passed.
- Per final user direction, completed keycaps and selected/legend accents become gray; active models keep their individual pigments, failures remain red, completion retains the check/Done label.

### Fact-checker vendor replacement
- Repeated Mistral shared-pool 429s persisted after both retries. Replaced its default/selectable catalog entry with `amazon/nova-2-lite-v1` (Cline catalog verified), including Nova brand geometry, orange active pigment and gray completion state. Historical runs retain their original model/error records.
- Catalog estimate: $0.30 input / $2.50 output per million tokens. Source: installed Cline model registry and https://openrouter.ai/amazon/nova-2-lite-v1 . No extra Amazon credential is required by the Cline gateway adapter.
- 32 tests passed after replacement.
- Nova build bundled and launched successfully. Native live test was blocked before run creation with `Save your Cline API key in Connections first`; this launch did not load a Cline secret. Nova API success is not claimed. Existing historical Mistral failure records are unchanged.
