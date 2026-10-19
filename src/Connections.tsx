import Select from "./ui/Select";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Github,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Mark } from "./Mark";
import {
  credentials,
  external,
  native,
  paths,
  request,
  saveCredential,
  saveNode,
} from "./bridge";
import type { Settings, Snapshot } from "./types";
export default function Connections({
  data,
  refresh,
  notify,
  onError,
}: {
  data: Snapshot;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
  onError: (s: string) => void;
}) {
  const [settings, setSettings] = useState<Settings>(data.settings);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [nodePath, setNodePath] = useState("");
  const [originalNode, setOriginalNode] = useState("");
  const [dataDir, setDataDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  useEffect(() => {
    setSettings(data.settings);
  }, [data.settings]);
  useEffect(() => {
    credentials()
      .then((value) => {
        setSaved(value);
        setCredentialsLoaded(true);
      })
      .catch((e) => onError(String(e)));
    paths()
      .then((p) => {
        setNodePath(p.nodePath ?? "");
        setOriginalNode(p.nodePath ?? "");
        setDataDir(p.dataDir);
      })
      .catch((e) => onError(String(e)));
  }, []);
  const update = (key: keyof Settings, value: string) =>
    setSettings((s) => ({ ...s, [key]: value }));
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (nodePath !== originalNode) {
      await saveNode(nodePath);
      setOriginalNode(nodePath);
      notify("Node path saved. Restart ClineBrain to use it.");
    }
    await request("settings.save", settings);
    for (const [key, value] of Object.entries(keys))
      if (value.trim()) await saveCredential(key, value.trim());
    setKeys({});
    setSaved(await credentials());
    await refresh();
    notify("Connections saved. Credentials are stored in macOS Keychain.");
  }
  async function pick(field: "codex" | "node") {
    if (!native) return;
    const selected = await open({
      title:
        field === "codex"
          ? "Choose Codex executable"
          : "Choose Node.js executable",
      multiple: false,
      directory: false,
    });
    if (typeof selected === "string") {
      if (field === "node") setNodePath(selected);
      else update("codexPath", selected);
    }
  }
  return (
    <div className="page-content connections">
      <div className="page-heading compact">
        <div>
          <div className="eyebrow">YOUR TOOLS. YOUR CHOICE.</div>
          <h1>
            Bring your own AI<span className="title-dot">.</span>
          </h1>
          <p>Connect your agents once. Give them a shared place to work.</p>
        </div>
        <button
          className="button primary"
          disabled={busy || !native}
          onClick={() => perform(save)}
        >
          {busy ? <Loader2 className="spin" size={16} /> : <Save size={16} />}{" "}
          Save connections
        </button>
      </div>
      <div className="connection-notice">
        <ShieldCheck size={20} />
        <span>
          API keys live in your macOS Keychain. Project memories stay on this
          Mac until you start an agent task.
        </span>
      </div>
      <section className="connection-section">
        <div className="connection-title">
          <span className="connection-logo">
            <Terminal size={22} />
          </span>
          <div>
            <h2>Local workspace</h2>
            <p>The home for your shared context and local agents.</p>
          </div>
        </div>
        <div className="connection-fields">
          <label>
            Project name
            <input
              value={settings.project}
              onChange={(e) => update("project", e.target.value)}
            />
          </label>
          <label>
            Node.js 22+ executable
            <div className="input-action">
              <input
                value={nodePath}
                onChange={(e) => setNodePath(e.target.value)}
                placeholder="/opt/homebrew/bin/node"
              />
              <button
                className="icon-button"
                title="Choose Node executable"
                onClick={() => pick("node")}
              >
                <FolderOpen size={17} />
              </button>
            </div>
            <small>Changing this path requires an app restart.</small>
          </label>
          <div className="storage-path">
            <span>LOCAL DATA</span>
            <code>{dataDir || "Available in the desktop app"}</code>
          </div>
        </div>
      </section>
      <section className="connection-section">
        <div className="connection-title">
          <span className="connection-logo peach">
            <Mark name="cline" size={25} />
          </span>
          <div>
            <h2>Cline orchestrator</h2>
            <p>The researcher and coordinator. Powered by your chosen model.</p>
          </div>
          <span
            className={`connection-state ${saved.cline ? "configured" : ""}`}
          >
            {!credentialsLoaded
              ? "Checking Keychain…"
              : saved.cline
                ? "Key saved"
                : "Setup required"}
          </span>
        </div>
        <div className="connection-fields">
          <div className="form-row">
            <label>
              Model provider
              <Select
                aria-label="Model provider"
                value={settings.providerId}
                onChange={(e) => {
                  update("providerId", e.target.value);
                  if (e.target.value === "cline")
                    setSettings((s) => ({
                      ...s,
                      providerId: "cline",
                      modelId: "anthropic/claude-sonnet-5.5",
                    }));
                }}
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="cline">Cline</option>
              </Select>
            </label>
            <label>
              Model ID
              <input
                value={settings.modelId}
                onChange={(e) => update("modelId", e.target.value)}
              />
            </label>
          </div>
          <KeyField
            name="cline"
            value={keys.cline ?? ""}
            saved={saved.cline}
            onChange={(v) => setKeys((k) => ({ ...k, cline: v }))}
          />
        </div>
      </section>
      <section className="connection-section">
        <div className="connection-title">
          <span className="connection-logo blue">
            <Mark name="codex" size={25} />
          </span>
          <div>
            <h2>Your Codex</h2>
            <p>
              Uses your existing CLI login. New tasks start with the shared
              memory.
            </p>
          </div>
          <span
            className={`connection-state ${checks.codex?.ok ? "configured" : ""}`}
          >
            {checks.codex?.ok ? "CLI found" : "Local CLI"}
          </span>
        </div>
        <div className="connection-fields">
          <label>
            Codex executable
            <div className="input-action">
              <input
                value={settings.codexPath}
                onChange={(e) => update("codexPath", e.target.value)}
                placeholder="Choose the installed Codex executable"
              />
              <button
                className="icon-button"
                title="Choose Codex executable"
                onClick={() => pick("codex")}
              >
                <FolderOpen size={17} />
              </button>
            </div>
            <small>
              Run <code>codex login</code> in Terminal if you have not signed
              in. Tasks are read-only.
            </small>
          </label>
        </div>
      </section>
      <section className="connection-section">
        <div className="connection-title">
          <span className="connection-logo violet">∥</span>
          <div>
            <h2>Parallel</h2>
            <p>Fresh research with sources your agents can follow.</p>
          </div>
          <button
            className="text-button"
            onClick={() => external("https://platform.parallel.ai")}
          >
            Get API key <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="connection-fields">
          <KeyField
            name="parallel"
            value={keys.parallel ?? ""}
            saved={saved.parallel}
            onChange={(v) => setKeys((k) => ({ ...k, parallel: v }))}
          />
        </div>
      </section>
      <section className="connection-section">
        <div className="connection-title">
          <span className="connection-logo green">
            <Github size={25} />
          </span>
          <div>
            <h2>GitHub via Composio</h2>
            <p>Read issues and publish the response you approve.</p>
          </div>
          <button
            className="text-button"
            onClick={() => external("https://dashboard.composio.dev")}
          >
            Dashboard <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="connection-fields">
          <KeyField
            name="composio"
            value={keys.composio ?? ""}
            saved={saved.composio}
            onChange={(v) => setKeys((k) => ({ ...k, composio: v }))}
          />
          <div className="form-row">
            <label>
              Composio user ID
              <input
                value={settings.userId}
                onChange={(e) => update("userId", e.target.value)}
              />
            </label>
            <label>
              GitHub auth config ID
              <input
                value={settings.authConfigId}
                onChange={(e) => update("authConfigId", e.target.value)}
                placeholder="Optional · created when you connect GitHub"
              />
            </label>
          </div>
          <label>
            Connected account ID
            <input
              value={settings.connectedAccountId}
              onChange={(e) => update("connectedAccountId", e.target.value)}
              placeholder="ca_…"
            />
            <small>
              Use an existing GitHub account ID, or connect one below.
            </small>
          </label>
          <button
            className="button secondary"
            disabled={busy || !native}
            onClick={() =>
              perform(async () => {
                await save();
                const link = await request<{ url: string }>("connections.link");
                await refresh();
                if (link.url) await external(link.url);
                notify(
                  "Complete GitHub connection in your browser, then run Check connections.",
                );
              })
            }
          >
            <Github size={16} /> Connect GitHub <ExternalLink size={13} />
          </button>
        </div>
      </section>
      <div className="connection-check">
        <div>
          <h3>Ready when you are.</h3>
          <p>
            Check the local CLI and authenticated GitHub access. Model and
            Parallel search is tested with a live request. Model keys are
            verified on the first Cline task.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy || !native}
          onClick={() =>
            perform(async () => {
              await save();
              setChecks(await request("connections.probe"));
            })
          }
        >
          <RefreshCw size={16} className={busy ? "spin" : ""} /> Check
          connections
        </button>
      </div>
      {Object.entries(checks).map(([k, v]) => (
        <div className={`check-row ${v.ok ? "ok" : "fail"}`} key={k}>
          {v.ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
          <strong>{k}</strong>
          <span>{v.message}</span>
        </div>
      ))}
      <div className="future-connections">
        <span className="eyebrow">THE COLLECTION, NEXT</span>
        <div>
          <Mark name="claude" />
          <span>Claude Code</span>
          <Mark name="grok" />
          <span>Grok</span>
          <Mark name="openclaw" />
          <span>OpenClaw</span>
          <span className="badge">Not connected · Coming later</span>
        </div>
        <p>
          3D tokens use the original Exawatt renderer and vendor mark geometry.{" "}
          <button
            className="text-button"
            onClick={() => external("https://github.com/Full-Vibe/exawatt")}
          >
            Source & attribution <ArrowUpRight size={12} />
          </button>
        </p>
      </div>
    </div>
  );
}
function KeyField({
  name,
  value,
  saved,
  onChange,
}: {
  name: string;
  value: string;
  saved?: boolean;
  onChange: (s: string) => void;
}) {
  return (
    <label>
      API key{" "}
      <span className="key-status">
        {saved && (
          <>
            <Check size={12} /> Saved in Keychain
          </>
        )}
      </span>
      <div className="input-action">
        <KeyRound size={15} />
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            saved
              ? "•••••••••••• — leave blank to keep"
              : `Paste your ${name === "cline" ? "model provider" : name} API key`
          }
        />
      </div>
    </label>
  );
}
