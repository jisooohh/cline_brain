# Third-party notices

The 3D tile renderer, geometry, material system, studio environment, motion and harness mark path data in `src/vendor/exawatt/` are adapted from [Full-Vibe/exawatt](https://github.com/Full-Vibe/exawatt/tree/69711062431077f991c1d2f5d71a42d5fbfc534b), commit `69711062431077f991c1d2f5d71a42d5fbfc534b`, under AGPL-3.0-or-later. Original comments are retained. ClineBrain is distributed under AGPL-3.0-or-later; the full license is in LICENSE.

Changes: local import/type boundaries, disabled audio, ClineBrain scene and actual workflow event integration. Original gummy material, rounded geometry, relief marks, studio lighting and pointer springs are retained.

Vendor marks identify providers and preview-only integrations, without affiliation or endorsement. Their upstream provenance and separate usage terms are retained in LICENSES/harness-marks.md.

Cline SDK packages: Apache-2.0. Composio SDK, React, Three.js, Vite: MIT. Tauri: MIT or Apache-2.0. Other npm dependencies retain their package licenses.

## Kuku (user-owned code, reused with explicit authorization)

Source: https://github.com/kuku-mom/kuku/tree/c690bb6e952472c788acb7e3ae948c84b03f2268

- `src/vendor/kuku/theme.ts`: original built-in dark/light theme definitions; removed the host plugin type import.
- `src/vendor/kuku/resize_grip.css`: original graph-paper resize grip CSS.
- `src/vendor/kuku/ResizeHandle.tsx`: React port of `apps/desktop/src/components/layout/resize_handle.tsx`, including pointer delta, reverse drag and cleanup; adds keyboard resizing.
- `src/vendor/kuku/layout.ts`: adapted panel bounds, ratios, localStorage persistence and proportional resize from `apps/desktop/src/stores/layout.ts`.
- Workspace structure follows Kuku `panel_layout.tsx`, `left_panel.tsx`, `bottom_panel.tsx`, and compact tab bar. SolidJS stores and plugin registry are adapted to this app's React state and actual memory/run data.

The PTY terminal is a new ClineBrain implementation using portable-pty and xterm.js, not copied from Kuku. Original Exawatt 3D renderer remains in the workspace overview.

### Kuku editor port (2026-10-19)

`src/vendor/kuku/upstream/` now contains the original core editor marks/nodes (including the CodeMirror code-block node view), Markdown conversion registry/service/handlers, frontmatter/task serialization, wikilink parser/node/handlers, slash-command definitions, blur-selection and WebKit IME helpers, and editor/wikilink CSS from the pinned source above (47 files).

Changes: rewrote `~/` imports to relative imports; narrowed the plugin type interface; removed the Solid app plugin lifecycle from the core-extension assembly; supplied the original English slash-menu strings via a small local lookup. `src/vendor/kuku/editor.ts` composes the original extensions and conversion services in the React host. `KukuEditor.tsx` adapts lifecycle, slash-menu rendering, commands, and document navigation. The existing Markdown storage, project isolation, Codex workflow and native PTY remain ClineBrain services.

This is a port of the editing/document workspace, not an import of Kuku's cloud sync, account backend, marketplace, planner or meeting services. No such services are exposed as working features.

### Kuku graph port (2026-10-19)

From the user-owned local checkout `/Users/manzi/Desktop/kuku/apps/desktop/src/plugins/builtin/graph_view/`: `graph_types.ts`, `graph_layout.ts`, and `graph_constellation.css` are copied into `src/vendor/kuku/graph/`. `layout.ts` extracts the original deterministic cluster-first `buildLayout` and stable hash helpers from `graph_canvas_pixi.tsx`, removing Solid/Pixi lifecycle mutations. ClineBrain adapts project-scoped documents into Kuku GraphNodes. The React SVG host reuses the Kuku 2D cursor-anchored exponential wheel zoom and Quiet Constellation surface styling. It does not import the full Pixi or 3D renderer or imply that memory status is a folder relationship.
Graph source checkout HEAD: `cfeaba00b3631c122b239131e7aad1bee804ca74` (local working-tree source as supplied by the user).

### Cline bot identity

Official Cline icon downloaded from https://raw.githubusercontent.com/cline/cline/main/docs/assets/cline-icon-white.svg (2026-10-19), as identified by the official docs configuration and https://cline.bot/brand. Original stored at `public/brands/cline.svg`; original body path plus lossless rounded-rectangle-to-path conversion feeds both the SVG and 3D mark registry. Cline identity is separate from the configured Claude model. Claude Code's future-connection identity remains Claude.

### Budget-model identities

DeepSeek, Qwen, Gemini and Mistral monochrome SVGs from `@lobehub/icons-static-svg` v1.95.1, https://github.com/lobehub/lobe-icons (MIT; LICENSES/lobe-icons-MIT.txt). Original SVGs retained in public/brands; their path geometry is used by both UI marks and 3D keycaps. Names/logos identify the selected model vendor; Cline remains the gateway/harness. Budget model IDs and dated estimate prices were checked against the installed Cline model catalog on 2026-10-19; they are not a promise of account entitlement or fixed billing.

The Kuku `graph_constellation.ts` pure helper module is copied unchanged from
`apps/desktop/src/plugins/builtin/graph_view/graph_constellation.ts` in the local
Kuku checkout. ClineBrain uses its focus-first, hub-ranked label selection in the
React graph adapter, alongside the previously ported Kuku graph types/layout/CSS.

MiniMax and Z.ai monochrome paths also use `@lobehub/icons-static-svg` v1.95.1
(MIT), retained at `public/brands/minimax.svg` and `public/brands/zai.svg`.

Amazon Nova's monochrome path uses `@lobehub/icons-static-svg` v1.95.1 (MIT),
retained in `public/brands/nova.svg`.
