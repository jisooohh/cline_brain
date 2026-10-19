import { useEffect, useRef, useState } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Plus, X, FolderOpen, TerminalSquare, ChevronDown } from "lucide-react";
import { native } from "./bridge";
import "@xterm/xterm/css/xterm.css";

type Event =
  | { type: "data"; bytes: number[] }
  | { type: "exit"; code: number | null }
  | { type: "error"; message: string };
type Tab = { key: string; cwd?: string };
function Shell({
  active,
  visible,
  cwd,
}: {
  active: boolean;
  visible: boolean;
  cwd?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const fit = useRef<() => void>(() => {});
  const [status, setStatus] = useState("Starting shell…");
  useEffect(() => {
    if (!container.current) return;
    if (!native) {
      setStatus("Open the desktop app to use your local terminal.");
      return;
    }
    let disposed = false,
      id: number | undefined;
    const term = new Terminal({
      cursorBlink: true,
      screenReaderMode: true,
      fontFamily: "Menlo, Monaco, monospace",
      fontSize: 12,
      lineHeight: 1.3,
      scrollback: 5000,
      allowProposedApi: false,
      theme: {
        background: "#1a1a1a",
        foreground: "#d4d4d4",
        cursor: "#d2edb5",
        selectionBackground: "#d4d4d433",
        black: "#222222",
        brightBlack: "#777777",
        green: "#98c379",
        blue: "#61aeee",
        red: "#e06c75",
        yellow: "#e5c07b",
        magenta: "#c678dd",
        cyan: "#56b6c2",
      },
    });
    const addon = new FitAddon();
    term.loadAddon(addon);
    term.open(container.current);
    const resize = () => {
      if (
        disposed ||
        !container.current?.clientHeight ||
        !container.current?.clientWidth
      )
        return;
      addon.fit();
      if (id !== undefined)
        void invoke("terminal_resize", {
          id,
          cols: term.cols,
          rows: term.rows,
        }).catch((e) => {
          if (!disposed) setStatus(String(e));
        });
    };
    fit.current = () => {
      resize();
      term.focus();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container.current);
    const channel = new Channel<Event>();
    channel.onmessage = (e) => {
      if (disposed) return;
      if (e.type === "data") term.write(new Uint8Array(e.bytes));
      if (e.type === "exit") {
        term.options.disableStdin = true;
        setStatus(
          `Shell exited (${e.code ?? "unknown"}). Open a new terminal to continue.`,
        );
        term.writeln(
          `\r\n\x1b[90m[Process exited: ${e.code ?? "unknown"}]\x1b[0m`,
        );
      }
      if (e.type === "error") setStatus(e.message);
    };
    const input = term.onData((data) => {
      if (id !== undefined)
        void invoke("terminal_write", { id, data }).catch((e) => {
          if (!disposed) setStatus(String(e));
        });
    });
    void invoke<number>("terminal_start", {
      onEvent: channel,
      cols: term.cols,
      rows: term.rows,
      cwd: cwd ?? null,
    })
      .then((value) => {
        id = value;
        if (disposed) {
          void invoke("terminal_close", { id }).catch(() => {});
          return;
        }
        setStatus("");
        resize();
        term.focus();
      })
      .catch((e) => {
        if (!disposed) setStatus(String(e));
      });
    return () => {
      disposed = true;
      observer.disconnect();
      input.dispose();
      term.dispose();
      if (id !== undefined)
        void invoke("terminal_close", { id }).catch(() => {});
    };
  }, [cwd]);
  useEffect(() => {
    if (active && visible) requestAnimationFrame(() => fit.current());
  }, [active, visible]);
  return (
    <div
      className="shell-session"
      style={{ display: active ? "flex" : "none" }}
    >
      <div className="shell-screen" ref={container} />
      {status && (
        <div className="shell-status" role="status">
          {status}
        </div>
      )}
    </div>
  );
}
export default function TerminalPanel({
  visible,
  toggle,
  expanded,
  onExpand,
}: {
  visible: boolean;
  toggle: () => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  const [tabs, setTabs] = useState<Tab[]>([{ key: crypto.randomUUID() }]);
  const [selected, setSelected] = useState(tabs[0].key);
  const [error, setError] = useState("");
  const add = (cwd?: string) => {
    const tab = { key: crypto.randomUUID(), cwd };
    setTabs((s) => [...s, tab]);
    setSelected(tab.key);
  };
  const close = (key: string) => {
    const next = tabs.filter((t) => t.key !== key);
    setTabs(next);
    if (selected === key) setSelected(next.at(-1)?.key ?? "");
  };
  return (
    <section className="terminal-panel" aria-label="Local terminal">
      <div className="terminal-toolbar">
        <span className="terminal-label">
          <TerminalSquare size={13} /> TERMINAL
        </span>
        <div className="terminal-tabs">
          {tabs.map((tab, index) => (
            <div
              className={
                selected === tab.key ? "terminal-tab selected" : "terminal-tab"
              }
              key={tab.key}
            >
              <button
                onClick={() => setSelected(tab.key)}
                title={tab.cwd || "Home directory"}
              >
                zsh {index + 1}
              </button>
              <button
                aria-label={`Close terminal ${index + 1}`}
                onClick={() => close(tab.key)}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="icon-button"
          title="New terminal"
          aria-label="New terminal"
          disabled={tabs.length >= 8}
          onClick={() => add()}
        >
          <Plus size={14} />
        </button>
        <button
          className="icon-button"
          title="Open terminal in folder"
          aria-label="Open terminal in folder"
          disabled={!native || tabs.length >= 8}
          onClick={async () => {
            try {
              const path = await open({
                directory: true,
                multiple: false,
                title: "Open terminal in folder",
              });
              if (typeof path === "string") add(path);
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          <FolderOpen size={14} />
        </button>
        <button
          className="icon-button"
          onClick={onExpand}
          aria-label={expanded ? "Restore terminal" : "Expand terminal"}
        >
          {expanded ? "↙" : "↗"}
        </button>
        <button
          className="icon-button"
          title="Hide terminal (⌘J)"
          aria-label="Hide terminal"
          onClick={toggle}
        >
          <ChevronDown size={15} />
        </button>
      </div>
      {error && (
        <div role="alert" className="shell-status">
          {error}
        </div>
      )}
      <div className="terminal-sessions">
        {tabs.map((tab) => (
          <Shell
            key={tab.key}
            active={selected === tab.key}
            visible={visible}
            cwd={tab.cwd}
          />
        ))}
        {!tabs.length && (
          <button className="terminal-empty" onClick={() => add()}>
            <Plus size={16} /> Open a local shell
          </button>
        )}
      </div>
    </section>
  );
}
