# ClineBrain

**Your agents. One shared brain.** A local-first macOS workspace for Cline and your own Codex CLI. Research a GitHub issue, carry project memories across agents, review the response, and publish a verified comment through Composio.

## Run

Requirements: macOS 12+, Node.js **22.13+**, Rust, Xcode command-line tools, and an installed, authenticated Codex CLI. The initial build targets the current Mac's architecture. The app uses the installed Node runtime; it is not bundled.

```sh
npm ci
npm run desktop
```

Build a native application:

```sh
npm run bundle
open src-tauri/target/release/bundle/macos/ClineBrain.app
```

`npm run dev` opens a **visual browser preview**. It cannot access native memory, credentials, or agent execution. Use the native application for functional testing.

## Connect

In **Connections**:

1. Confirm the absolute Node and Codex executable paths. Run `codex login` in Terminal if necessary. Node path changes take effect after restart.
2. Choose the Cline model provider and its exact model ID. Enter that provider's API key. The default is Anthropic / `claude-sonnet-4-6`. CLI subscription authentication is separate from this key.
3. Enter a Parallel API key.
4. Enter a Composio project API key, a stable user ID and an existing GitHub connected-account ID. Alternatively enter your GitHub auth-config ID, select **Connect GitHub**, and complete authorization in the browser.
5. **Save connections**, then **Check connections**. This verifies Codex availability, a live Parallel search and authenticated GitHub access. Cline model inference is validated on its first workflow.

Secrets are saved through macOS Keychain (`ai.clinebrain.desktop`), never in the repository or SQLite. The worker receives them through its private stdin bridge. Keychain access failures are surfaced. Do not put credentials into project notes.

## First workflow

1. Add a project note in **Shared brain** (sample in `docs/demo/project-memory.md`).
2. Choose **From issue to action** and paste a GitHub issue URL.
3. Cline calls Parallel search/extract, then delegates the same memory snapshot and sources to `codex exec --json` in a read-only workspace.
4. Open **Context** to inspect the selected memories and research. Open **Activity** for actual execution events.
5. Edit and save the draft if needed. Check the review box, then **Approve & publish comment**.
6. The app rereads the comment and reports the verified GitHub URL. An uncertain response is reconciled by an embedded operation marker; it is never blindly resent.
7. **Keep** the proposed memory. A subsequent task includes active memories from that project.

The two daily automation templates use this same pipeline. **Daily Project Brief** also reads recent issue comments. They run only while the app is open and the Mac is awake. Missed or busy scheduled slots are marked for manual catch-up. Publication always requires review.

## Implementation

- `src/`: React UI, Tauri bridge, original Exawatt Three.js tile renderer adapted to actual task events.
- `src-tauri/`: Rust process bridge, native executable selection and Keychain access.
- `worker/`: Node workflow engine, Cline SDK agent, Parallel API, Composio authenticated GitHub proxy, Codex adapter, SQLite/Markdown store and daily scheduler.

Native IPC accepts an explicit command allowlist. The worker is bundled into a local resource and communicates over JSONL, without exposing an HTTP server. Cline has only research and delegation tools; GitHub writes are outside the model's tool set. Codex runs without user-configured hooks/MCP configuration in an app-managed read-only workspace. The SDK's `@cline/agents` and `@cline/shared` package entry points are imported directly to avoid unrelated full-core native dependencies.

Memories live in the application's `brain/` directory as Markdown with metadata. SQLite stores derived text search, proposals, schedules and run logs. File replacement is atomic per memory; startup reconciles Markdown into the index. Memory edits require the current revision. Source content is retained as a task snapshot; external folder sync and a full wiki editor are not part of this release.

## Checks

```sh
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Tests cover active/project-scoped context, Korean search, stale revisions, restart recovery, daily scheduling, duplicate publication, changed approvals, and ambiguous write reconciliation. Unit tests use injected GitHub transport; passing them is not evidence of a live account connection. See `docs/verification.md` for what was exercised on the local Mac.

## Design and license

The user requested the original Exawatt 3D appearance. ClineBrain reuses its rounded geometry, gummy material, extruded vendor logo paths, studio environment and pointer springs. Additional logo tokens are explicitly labeled **collection preview**; only Cline orchestration and Codex CLI are supported in this MVP. See `THIRD_PARTY_NOTICES.md` and `LICENSES/harness-marks.md`.

AGPL-3.0-or-later; full license in `LICENSE`. No affiliation with Exawatt or the model vendors. This hackathon build is not notarized, has no auto-updater, and requires the locally installed Node and Codex executables.

### Kuku workspace and terminal

The workspace uses Kuku's original theme and resize grip styles, with React ports of its resizable panel logic. The sidebar contains Second Brain, Active AI, Automations and Connections. Active memories and current Cline/Codex work are visible without leaving the current page.

The bottom panel runs real login shells through Rust `portable-pty` and xterm.js. Use **⌘J** to hide/show without stopping a shell, **+** for a new shell (up to eight), the folder button for a chosen working directory, and **×** to stop a session. Drag panel separators to resize; layout sizes persist. Ctrl+C, shell history, ANSI colors and Unicode input use the PTY directly. Closing the application terminates its terminal sessions; terminal sessions and scrollback do not survive an app restart. Terminal commands run with your normal user permissions and are separate from the read-only Codex workflow.

The default main view is now a document workspace: saved notes open in central tabs, with Markdown reading/editing, explicit Save / ⌘S, status selection and source links. Drafts survive tab switches and are cached locally per project; they enter agent context only after saving with Active status. Closing an edited tab offers save, discard or keep editing. The original 3D board remains under Workspace.

### Codex document tasks

Open a document in Second Brain, then choose **Active AI → Work with Codex**. Enter an instruction and press **Run Codex**. This path needs only your existing local Codex CLI login; it does not require Cline, Parallel or Composio keys. The current document (including unsaved text) is captured with the instruction. Relevant active memories from the same project are included; the exact input snapshots are visible under Input context and persisted in run history.

Codex executes in read-only mode. Its Markdown response is saved automatically as a new **Suggested** document linked to the source run. **Open result document** opens it in the editor. Set it to Active and save to include it in subsequent shared memory. Cancelling or failing a task creates no successful output document. Multiple GitHub and document workflows can run concurrently within the shared process budget.

### Kuku document editor

The document body now runs Kuku's actual ProseKit editor schema, Markdown round-trip handlers, flat lists, task checkboxes, tables, CodeMirror code blocks, wikilinks and WebKit IME fixes. Type `/` for the original block menu. Use `[[Title]]` to navigate to a saved document. The right panel shows outline and backlinks. The source button switches to raw Markdown.

Auto save is enabled by default with a one-second idle delay; turn it off in the document toolbar for explicit saving. Unsaved drafts remain cached. Conflicting revisions stop saving and preserve the draft. ⌘P opens document search, ⌘N creates a note, ⌘S saves; drag document tabs to reorder or middle-click to close. Active tab selection is restored on restart. The terminal and Codex task flow use the same current document text.

`node scripts/test-kuku.mjs` validates Kuku Markdown round trips for Korean, formatting, checklists, tables, code blocks, frontmatter, blank paragraphs, nested lists and wikilinks.

### Work beside your document

Use **Your agent team** in the right-hand **Active AI** inspector. Enter a task and press **⌘Enter** (or **Run Codex**). The current document, including unsaved text, and active project memories are captured for that run. You can continue reading the source while checking progress, cancelling the run, inspecting its input, or reading the completed Markdown in the same inspector. **Open result document** opens the saved suggestion centrally only when you choose it.

### Parallel Luna teams

The default document workflow is a GPT-6 Luna team: three independent subagent sessions (context analyst, writer, critical reviewer), then a lead session that synthesizes their actual reports. Choose Solo or 1–6 subagents and Luna/Sol in the right panel. Multiple workflows can run together: up to 8 workflows, with a shared FIFO budget of 6 simultaneous Codex processes. Each workflow captures its own document/memory snapshot. Select a workflow to inspect its agent tree, individual reports, or final result; cancelling one workflow does not stop others. Stopping a subagent preserves sibling reports but blocks the combined result. Interrupted agent states are restored explicitly on restart.

Optional **Web research · Parallel** sends the task instruction to Parallel and shares cited search excerpts with the team. Save its key in Connections first. **Check connections** now runs a real Parallel search. Save the Composio project key and press **Connect GitHub**; if no auth config is supplied, the app prepares a managed GitHub config for public repository access and opens the consent flow. Complete account signup and GitHub consent in the browser; secrets remain in macOS Keychain.

### Second Brain graph

Open **Second Brain → Graph** in the document tab bar. Saved notes become nodes; `[[Document title]]` links become edges within the current project. Aliases and heading suffixes are supported. Unresolved or ambiguous names are counted without inventing connections. Search filters the graph; scroll zooms at the pointer, drag pans, and +/- and reset controls are also available. Click a node (or focus it and press Enter) to emphasize its direct context connections. The context panel shows full titles and linked memories/results; use Open document to navigate. The editor remains mounted while viewing the graph, preserving its draft. Archived notes are hidden until enabled; suggested notes remain excluded from agent memory unless adopted.

The graph reuses Kuku's deterministic layout and Quiet Constellation surface styles with a React/SVG host. See THIRD_PARTY_NOTICES.md for port boundaries.

### Mixed budget subagents

Document teams default to six distinct Cline-backed workers (DeepSeek V4.1 Flash, Qwen3.8 Flash, Gemini 3.5 Flash-Lite, Amazon Nova 2 Lite, MiniMax M3, GLM 5.3 Flash) and a local Codex lead. Settings lets you change each worker, including Amazon Nova 2 Lite, or use local Codex workers. The saved Cline gateway key is required; no extra vendor keys are needed. Catalog prices are estimates, subject to Cline billing and availability. All workers receive the same captured document and active memories; Codex synthesizes their reports into a suggested Markdown document. Failures and individual cancellations remain visible and prevent synthesis from being reported as successful.
