import { build } from "esbuild";
import { mkdirSync } from "node:fs";
mkdirSync("src-tauri/resources", { recursive: true });
await build({
  entryPoints: ["worker/index.mjs"],
  outfile: "src-tauri/resources/worker.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: [
    "better-sqlite3",
    "@lydell/node-pty",
    "@lydell/node-pty-darwin-arm64",
    "@lydell/node-pty-darwin-x64",
    "sharp",
    "electron",
    "onnxruntime-node",
  ],
  define: { "import.meta.url": "__filename" },
  logLevel: "info",
});
