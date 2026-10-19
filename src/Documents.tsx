import BrainGraph from "./BrainGraph";
import Select from "./ui/Select";
import { useEffect, useRef, useState } from "react";
import KukuEditor from "./KukuEditor";

import {
  ChevronLeft,
  ChevronRight,
  Network,
  FileText,
  Plus,
  X,
  Save,
  Eye,
  Code2,
  ArrowUpRight,
  Search,
} from "lucide-react";
import type { BrainItem, Run } from "./types";
import { external } from "./bridge";

type Draft = {
  key: string;
  original?: BrainItem;
  title: string;
  body: string;
  status: BrainItem["status"];
  dirty: boolean;
};
export type DocumentRequest = { token: string; item: BrainItem | null } | null;
const draftOf = (item?: BrainItem): Draft => ({
  key: item?.id ?? crypto.randomUUID(),
  original: item,
  title: item?.title ?? "",
  body: item?.body ?? "",
  status: item?.status ?? "active",
  dirty: false,
});
export default function Documents({
  items,
  runs,
  project,
  request,
  onSave,
  onRun,
  onCurrent,
  onReveal,
}: {
  items: BrainItem[];
  runs: Run[];
  project: string;
  request: DocumentRequest;
  onReveal: () => void;
  onSave: (input: unknown) => Promise<BrainItem>;
  onRun: (id: string) => void;
  onCurrent: (
    document: {
      id?: string;
      revision?: string;
      title: string;
      body: string;
      project: string;
      dirty: boolean;
    } | null,
  ) => void;
}) {
  const storageKey = "clinebrain-documents-v1:" + project;
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (
        Array.isArray(value) &&
        value.length &&
        value.every(
          (d) =>
            typeof d.key === "string" &&
            typeof d.body === "string" &&
            typeof d.title === "string",
        )
      )
        return value;
    } catch {
      /* recover from invalid UI state */
    }
    return [draftOf(items[0])];
  });
  const [selected, setSelected] = useState(() => {
    const saved = localStorage.getItem(storageKey + ":selected");
    return drafts.some((d) => d.key === saved) ? saved! : drafts[0].key;
  });
  const tabViewport = useRef<HTMLDivElement>(null);
  const tabTrack = useRef<HTMLDivElement>(null);
  const [tabScroll, setTabScroll] = useState({
    left: false,
    right: false,
    overflow: false,
  });
  useEffect(() => {
    const viewport = tabViewport.current,
      track = tabTrack.current;
    if (!viewport || !track) return;
    const update = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      setTabScroll({
        left: viewport.scrollLeft > 1,
        right: viewport.scrollLeft < max - 1,
        overflow: max > 1,
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(track);
    viewport.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  const scrollTabs = (direction: number) => {
    const viewport = tabViewport.current;
    viewport?.scrollBy({
      left: direction * Math.max(180, viewport.clientWidth * 0.65),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const [graphOpen, setGraphOpen] = useState(false);
  useEffect(() => {
    if (graphOpen) return;
    const viewport = tabViewport.current;
    const tab = Array.from(tabTrack.current?.children ?? []).find(
      (el) => (el as HTMLElement).dataset.docKey === selected,
    ) as HTMLElement | undefined;
    if (!viewport || !tab) return;
    const bounds = viewport.getBoundingClientRect(),
      item = tab.getBoundingClientRect();
    if (item.left < bounds.left) viewport.scrollLeft += item.left - bounds.left;
    else if (item.right > bounds.right)
      viewport.scrollLeft += item.right - bounds.right;
  }, [selected, drafts.length, graphOpen]);
  const [reading, setReading] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [autoSave, setAutoSave] = useState(
    () => localStorage.getItem("kuku-autosave") !== "false",
  );
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickIndex, setQuickIndex] = useState(0);
  const dragging = useRef<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const handled = useRef<string | undefined>(undefined);
  const current = drafts.find((d) => d.key === selected);
  useEffect(() => {
    onCurrent(
      current
        ? {
            id: current.original?.id,
            revision: current.original?.revision,
            title: current.title,
            body: current.body,
            project,
            dirty: current.dirty,
          }
        : null,
    );
  }, [
    current?.key,
    current?.title,
    current?.body,
    current?.dirty,
    current?.original?.revision,
    project,
    onCurrent,
  ]);
  const open = (item?: BrainItem) => {
    setGraphOpen(false);
    const existing = item && drafts.find((d) => d.original?.id === item.id);
    if (existing) {
      setSelected(existing.key);
      return;
    }
    const draft = draftOf(item);
    setDrafts((s) => [...s, draft]);
    setSelected(draft.key);
    setReading(false);
  };
  useEffect(() => {
    if (
      !request ||
      handled.current === request.token ||
      (request.item && request.item.project !== project)
    )
      return;
    handled.current = request.token;
    open(request.item ?? undefined);
  }, [request]);
  useEffect(() => {
    const timer = setTimeout(
      () => localStorage.setItem(storageKey, JSON.stringify(drafts)),
      200,
    );
    return () => clearTimeout(timer);
  }, [drafts, storageKey]);
  // Refresh clean tabs after worker updates while preserving unsaved edits and their base revision.
  useEffect(() => {
    setDrafts((previous) =>
      previous.map((d) => {
        const latest = items.find((i) => i.id === d.original?.id);
        return !d.dirty && latest && latest.revision !== d.original?.revision
          ? { ...draftOf(latest), key: d.key }
          : d;
      }),
    );
  }, [items]);
  const edit = (patch: Partial<Draft>) =>
    setDrafts((s) =>
      s.map((d) => (d.key === selected ? { ...d, ...patch, dirty: true } : d)),
    );
  async function save(key = selected) {
    const draft = drafts.find((d) => d.key === key);
    if (!draft || busy) return false;
    setBusy(true);
    setError("");
    try {
      const result = await onSave({
        ...draft.original,
        title: draft.title,
        body: draft.body,
        status: draft.status,
        project,
      });
      setDrafts((s) =>
        s.map((d) => (d.key === key ? { ...draftOf(result), key } : d)),
      );
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const remove = (key: string) => {
    const remaining = drafts.filter((d) => d.key !== key);
    setDrafts(remaining);
    if (selected === key) setSelected(remaining.at(-1)?.key ?? "");
    setClosing(null);
  };
  useEffect(() => {
    localStorage.setItem(storageKey + ":selected", selected);
  }, [selected, storageKey]);
  useEffect(() => {
    if (
      !autoSave ||
      !current?.dirty ||
      !current.title.trim() ||
      !current.body.trim() ||
      busy ||
      composing ||
      error
    )
      return;
    const timer = setTimeout(() => void save(), 1000);
    return () => clearTimeout(timer);
  }, [
    autoSave,
    current?.key,
    current?.title,
    current?.body,
    current?.status,
    current?.dirty,
    busy,
    composing,
    error,
  ]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        onReveal();
        setQuickOpen(true);
        setQuickQuery("");
        setQuickIndex(0);
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        onReveal();
        open();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const quickResults = items
    .filter((i) =>
      (i.title + " " + i.body).toLowerCase().includes(quickQuery.toLowerCase()),
    )
    .slice(0, 20);
  return (
    <div
      className="documents-workspace"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          void save();
        }
      }}
    >
      {quickOpen && (
        <div
          className="quick-open-backdrop"
          onMouseDown={() => setQuickOpen(false)}
        >
          <div
            className="quick-open"
            role="dialog"
            aria-label="Quick open documents"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div>
              <Search size={18} />
              <input
                autoFocus
                placeholder="Search documents and contents…"
                aria-label="Quick document search"
                value={quickQuery}
                onChange={(e) => {
                  setQuickQuery(e.target.value);
                  setQuickIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuickOpen(false);
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setQuickIndex((i) =>
                      Math.min(i + 1, quickResults.length - 1),
                    );
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setQuickIndex((i) => Math.max(0, i - 1));
                  }
                  if (e.key === "Enter" && quickResults[quickIndex]) {
                    open(quickResults[quickIndex]);
                    setQuickOpen(false);
                  }
                }}
              />
              <kbd>esc</kbd>
            </div>
            {quickResults.map((item, i) => (
              <button
                className={i === quickIndex ? "selected" : ""}
                key={item.id}
                onClick={() => {
                  open(item);
                  setQuickOpen(false);
                }}
              >
                <FileText size={16} />
                <span>
                  {item.title}
                  <small>{item.body.replace(/[#*`]/g, "").slice(0, 90)}</small>
                </span>
                <small>{item.status}</small>
              </button>
            ))}
            {!quickResults.length && <p>No matching documents</p>}
            <footer>↑↓ Navigate · ↵ Open · ⌘N New document</footer>
          </div>
        </div>
      )}
      <div className="document-tabs">
        <div className="document-tab-viewport" ref={tabViewport}>
          <div className="document-tab-track" ref={tabTrack}>
            {drafts.map((d) => (
              <div
                className={
                  "document-tab " +
                  (d.key === selected && !graphOpen ? "selected" : "")
                }
                key={d.key}
                draggable
                onDragStart={() => {
                  dragging.current = d.key;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragging.current;
                  if (!from || from === d.key) return;
                  setDrafts((prev) => {
                    const moved = prev.find((x) => x.key === from)!;
                    const next = prev.filter((x) => x.key !== from);
                    next.splice(
                      next.findIndex((x) => x.key === d.key),
                      0,
                      moved,
                    );
                    return next;
                  });
                  dragging.current = null;
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    d.dirty ? setClosing(d.key) : remove(d.key);
                  }
                }}
              >
                <button
                  onClick={() => {
                    setSelected(d.key);
                    setGraphOpen(false);
                  }}
                >
                  <FileText size={13} />
                  <span className="document-tab-title">
                    {d.title || "Untitled"}
                  </span>
                  {d.dirty && <span className="unsaved-dot" />}
                </button>
                <button
                  aria-label={"Close document " + (d.title || "Untitled")}
                  onClick={() => (d.dirty ? setClosing(d.key) : remove(d.key))}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
        {tabScroll.overflow && (
          <div
            className="document-tab-navigation"
            aria-label="Scroll document tabs"
          >
            <button
              aria-label="Scroll tabs left"
              disabled={!tabScroll.left}
              onClick={() => scrollTabs(-1)}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              aria-label="Scroll tabs right"
              disabled={!tabScroll.right}
              onClick={() => scrollTabs(1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        <button
          className="icon-button"
          title="New document"
          aria-label="New document"
          onClick={() => open()}
        >
          <Plus size={15} />
        </button>
        <button
          className="graph-tab"
          aria-pressed={graphOpen}
          onClick={() => setGraphOpen((s) => !s)}
        >
          <Network size={14} />
          Graph
        </button>
      </div>
      {closing && (
        <div className="document-close-prompt" role="alert">
          This document has unsaved changes.
          <button
            disabled={busy}
            onClick={async () => {
              if (await save(closing)) remove(closing);
            }}
          >
            Save & close
          </button>
          <button disabled={busy} onClick={() => remove(closing)}>
            Discard changes
          </button>
          <button onClick={() => setClosing(null)}>Keep editing</button>
        </div>
      )}
      <div
        className="document-toolbar"
        style={graphOpen ? { display: "none" } : undefined}
      >
        <span>
          {project} <span className="doc-slash">/</span>{" "}
          {current?.title || "Untitled"}.md
        </span>
        <div>
          <label className="autosave-toggle">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => {
                setAutoSave(e.target.checked);
                localStorage.setItem("kuku-autosave", String(e.target.checked));
              }}
            />{" "}
            Auto save
          </label>
          <button
            className="icon-button"
            title="Quick open (⌘P)"
            aria-label="Quick open"
            onClick={() => setQuickOpen(true)}
          >
            <Search size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Toggle Markdown source"
            title="Toggle Markdown source"
            onClick={() => setSourceMode((s) => !s)}
          >
            <Code2 size={15} />
          </button>
          <button
            className="icon-button"
            title={reading ? "Edit Markdown" : "Read document"}
            aria-label={reading ? "Edit Markdown" : "Read document"}
            onClick={() => setReading((s) => !s)}
          >
            {reading ? <Code2 size={15} /> : <Eye size={15} />}
          </button>
          <button
            className="button document-save"
            disabled={busy || !current?.title.trim() || !current.body.trim()}
            onClick={() => void save()}
          >
            <Save size={13} />
            {busy ? "Saving…" : "Save"} <kbd>⌘S</kbd>
          </button>
        </div>
      </div>
      {error && (
        <div className="inline-error document-error" role="alert">
          {error}
        </div>
      )}
      {graphOpen && (
        <BrainGraph
          runs={runs}
          onRun={onRun}
          items={items}
          project={project}
          currentId={current?.original?.id}
          onOpen={open}
        />
      )}
      {current ? (
        <div
          className={
            "document-with-inspector" + (graphOpen ? " graph-hidden" : "")
          }
        >
          <div
            className="document-scroll"
            data-editor-scroll
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
          >
            <article className="document-page">
              <div className="document-kicker">
                <FileText size={14} /> SECOND BRAIN{" "}
                <span>
                  {current.dirty
                    ? "Unsaved changes"
                    : current.original
                      ? "Saved locally"
                      : "New document"}
                </span>
              </div>
              <input
                className="document-title"
                aria-label="Document title"
                placeholder="Untitled"
                maxLength={200}
                value={current.title}
                disabled={busy}
                onChange={(e) => edit({ title: e.target.value })}
              />
              <div className="document-properties">
                <span>Status</span>
                <Select
                  aria-label="Memory status"
                  value={current.status}
                  disabled={busy}
                  onChange={(e) =>
                    edit({ status: e.target.value as BrainItem["status"] })
                  }
                >
                  <option value="active">Active · shared with agents</option>
                  <option value="proposed">
                    Suggested · awaiting adoption
                  </option>
                  <option value="archived">
                    Archived · excluded from context
                  </option>
                </Select>
              </div>
              {sourceMode ? (
                <textarea
                  className="document-editor source-editor"
                  aria-label="Document Markdown"
                  value={current.body}
                  disabled={busy || reading}
                  onChange={(e) => edit({ body: e.target.value })}
                />
              ) : (
                <KukuEditor
                  key={current.key}
                  value={current.body}
                  disabled={busy || reading}
                  onChange={(body) => edit({ body })}
                  onLink={(title) => {
                    const found = items.find(
                      (i) =>
                        i.title.toLowerCase() ===
                        title.replace(/\.md$/, "").toLowerCase(),
                    );
                    if (found) open(found);
                    else {
                      setQuickQuery(title);
                      setQuickOpen(true);
                    }
                  }}
                />
              )}
              {!!current.original?.sources.length && (
                <div className="document-sources">
                  <h3>Sources</h3>
                  {current.original.sources.map((s) => (
                    <button key={s.url} onClick={() => void external(s.url)}>
                      {s.title}
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
              )}
              {current.original?.runId && (
                <button
                  className="text-button"
                  onClick={() => onRun(current.original!.runId!)}
                >
                  Open source task <ArrowUpRight size={13} />
                </button>
              )}
              <footer className="document-footnote">
                {current.body.trim().split(/\s+/).filter(Boolean).length} words
                · Markdown ·{" "}
                {current.status === "active"
                  ? "Available to your agents after saving"
                  : "Excluded from agent context"}
              </footer>
            </article>
          </div>
        </div>
      ) : (
        <div className={"document-empty" + (graphOpen ? " graph-hidden" : "")}>
          <FileText size={32} />
          <h2>Your second brain starts with a document.</h2>
          <button className="button" onClick={() => open()}>
            <Plus size={14} /> New document
          </button>
          <div className="document-find">
            <Search size={14} />
            <input
              aria-label="Find document"
              placeholder="Find a saved document…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {items
            .filter((i) =>
              (i.title + i.body).toLowerCase().includes(query.toLowerCase()),
            )
            .map((i) => (
              <button
                key={i.id}
                className="document-result"
                onClick={() => open(i)}
              >
                <FileText size={13} />
                {i.title}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
