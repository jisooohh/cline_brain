import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function discoverCodex() {
  return (
    [
      process.env.CLINEBRAIN_CODEX,
      join(homedir(), ".local/bin/codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
      "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
      "/Applications/Codex.app/Contents/Resources/codex",
    ].find((p) => p && existsSync(p)) ?? ""
  );
}
export class CodexAdapter {
  constructor(path, cwd) {
    this.path = path;
    this.cwd = cwd;
    this.child = null;
  }
  async probe() {
    return new Promise((resolve, reject) => {
      const c = spawn(this.path, ["--version"], { shell: false });
      let out = "";
      c.stdout.on("data", (d) => (out += d));
      c.on("error", reject);
      c.on("exit", (code) =>
        code === 0
          ? resolve(out.trim())
          : reject(new Error("Codex unavailable")),
      );
      setTimeout(() => {
        if (c.exitCode === null) c.kill();
      }, 5000).unref();
    });
  }
  cancel() {
    if (this.child) {
      try {
        process.kill(-this.child.pid, "SIGTERM");
      } catch {
        this.child.kill("SIGTERM");
      }
      const c = this.child;
      setTimeout(() => {
        try {
          process.kill(-c.pid, "SIGKILL");
        } catch {}
      }, 1500).unref();
    }
  }
  async start(prompt, onEvent, signal, options = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("Cancelled"));
      const args = [
        "exec",
        "--json",
        "--ephemeral",
        "--ignore-user-config",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--color",
        "never",
        "-C",
        this.cwd,
        "-",
      ];
      if (options.model)
        args.splice(
          1,
          0,
          "--model",
          options.model,
          "-c",
          'model_reasoning_effort="low"',
        );
      const c = spawn(this.path, args, {
        cwd: this.cwd,
        detached: true,
        shell: false,
        env: {
          PATH: process.env.PATH,
          HOME: homedir(),
          USER: process.env.USER,
          TMPDIR: process.env.TMPDIR,
          LANG: process.env.LANG ?? "en_US.UTF-8",
        },
      });
      this.child = c;
      let answer = "",
        error = "",
        failure = "";
      const abort = () => this.cancel();
      signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => {
        failure = "Codex exceeded the 4 minute limit";
        this.cancel();
      }, 240000);
      createInterface({ input: c.stdout }).on("line", (line) => {
        try {
          const e = JSON.parse(line);
          if (e.type === "item.completed" && e.item?.type === "agent_message")
            answer = e.item.text;
          if (e.type === "error" || e.type === "turn.failed")
            failure = e.message ?? e.error?.message ?? "Codex turn failed";
          onEvent(e);
        } catch {}
      });
      c.stderr.on("data", (d) => {
        error = (error + d.toString()).slice(-2000);
      });
      c.on("error", (e) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        this.child = null;
        reject(e);
      });
      c.on("close", (code) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        this.child = null;
        if (signal?.aborted) return reject(new Error("Cancelled"));
        if (code !== 0 || failure || !answer)
          return reject(
            new Error(
              failure ||
                `Codex exited ${code}: ${error || "No response received. Check CLI login."}`,
            ),
          );
        resolve(answer);
      });
      c.stdin.on("error", () => {});
      c.stdin.end(prompt);
    });
  }
}
export async function parallelRequest(key, endpoint, body, signal) {
  if (!key) throw new Error("Add your Parallel API key in Connections.");
  if (endpoint === "search") {
    const { max_results = 5, ...rest } = body;
    body = { mode: "basic", ...rest, advanced_settings: { max_results, ...rest.advanced_settings } };
  }
  const response = await fetch(`https://api.parallel.ai/v1/${endpoint}`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
      : AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(`Parallel ${endpoint} returned ${response.status}: ${String(detail.error?.message ?? detail.message ?? "Check the request, key and quota").slice(0,600)}`);
  }
  return response.json();
}
