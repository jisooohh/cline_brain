import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Brain,
  Boxes,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  Home,
  Loader2,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Mark } from "./Mark";
import { request, events, empty, native, external } from "./bridge";
import type {
  Snapshot,
  Page,
  Run,
  BrainItem,
  Proposal,
  Automation,
} from "./types";
import Connections from "./Connections";
import CodexWork from "./CodexWork";
import Documents, { type DocumentRequest } from "./Documents";
import TerminalPanel from "./TerminalPanel";
import ResizeHandle from "./vendor/kuku/ResizeHandle";
import { usePanelLayout } from "./vendor/kuku/layout";
import { themeDefaultPlugin } from "./vendor/kuku/theme";
import { TerminalSquare, PanelLeft, Bot } from "lucide-react";
import AgentMonitor from "./AgentMonitor";
import DocumentInspector from "./DocumentInspector";
const date = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function App() {
  const layout = usePanelLayout();
  const [data, setData] = useState<Snapshot>(empty);
  const [page, setPage] = useState<Page>("brain");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [startOpen, setStartOpen] = useState(false);
  const [documentRequest, setDocumentRequest] = useState<DocumentRequest>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const openDocument = (item: BrainItem | null = null) => {
    setPage("brain");
    setDocumentRequest({ token: crypto.randomUUID(), item });
  };
  const [currentDocument, setCurrentDocument] = useState<
    Run["document"] | null
  >(null);
  const [agent, setAgent] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setData(await request<Snapshot>("snapshot"));
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    let dispose: (() => void) | undefined;
    let alive = true;
    events((e) => {
      if (e.type === "state" && e.data) setData(e.data);
      if (e.type === "worker-error") setError(e.message ?? "Worker stopped");
    }).then((fn) => {
      if (alive) dispose = fn;
      else fn();
    });
    return () => {
      alive = false;
      dispose?.();
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function act<T = unknown>(
    method: string,
    params: unknown = {},
  ): Promise<T> {
    try {
      const result = await request<T>(method, params);
      await refresh();
      return result;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }
  const activeRuns = data.runs.filter((r) => r.status === "running");
  const active = activeRuns[0];
  const workingCount = activeRuns.reduce(
    (n, r) =>
      n +
      (r.agents ? r.agents.filter((a) => a.status === "running").length : 1),
    0,
  );
  const codexWorking = activeRuns.some(
    (r) => r.template === "document" || r.stage === "draft",
  );
  const clineWorking = activeRuns.some(
    (r) => r.template !== "document" && r.stage !== "draft",
  );
  const recent = data.runs.filter((r) => r.project === data.settings.project);
  useEffect(() => {
    if (!selectedRun && recent.length)
      setSelectedRun(recent.find((r) => r.template === "document")?.id ?? null);
  }, [recent, selectedRun]);
  useEffect(() => {
    if (layout.rightVisible && layout.inspectorTab === "agents")
      document
        .getElementById("sidebar-codex-instruction")
        ?.focus({ preventScroll: true });
  }, [layout.rightVisible, layout.inspectorTab]);
  const memories = data.brain.filter(
    (m) => m.project === data.settings.project && m.status === "active",
  );
  const run = data.runs.find((r) => r.id === selectedRun);
  const [filter, setFilter] = useState("");
  const nav = [
    { id: "home", name: "Workspace", icon: Home },
    { id: "brain", name: "Second Brain", icon: Brain },
    { id: "agents", name: "Active AI", icon: Bot },
    { id: "automations", name: "Automations", icon: Workflow },
    { id: "connections", name: "Connections", icon: Cable },
  ] as const;
  const newRun = (template = "issue") => {
    setRunTemplate(template);
    setStartOpen(true);
  };
  const [runTemplate, setRunTemplate] = useState("issue");
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        setPage(
          (["home", "brain", "automations", "connections"] as Page[])[
            Number(event.key) - 1
          ],
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        layout.toggleBottomPanel();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [layout.toggleBottomPanel]);
  const theme = themeDefaultPlugin.themes[0].variants[0].colors;
  return (
    <div
      className="app-shell kuku-workspace"
      style={
        {
          "--color-bg-primary": theme.bgPrimary,
          "--color-bg-secondary": theme.bgSecondary,
          "--color-text-primary": theme.textPrimary,
          "--color-border": theme.border,
        } as React.CSSProperties
      }
    >
      <aside className="sidebar" style={{ width: layout.leftPanelWidth }}>
        <div className="drag-space" data-tauri-drag-region />
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
          }}
        >
          <span className="brand-icon">
            <Boxes size={22} />
          </span>
          ClineBrain<span className="beta">BETA</span>
        </a>
        <button
          className="project-switch"
          onClick={() => setPage("connections")}
        >
          <span className="project-avatar">
            {data.settings.project.slice(0, 1)}
          </span>
          <span>
            {data.settings.project}
            <small>Personal workspace</small>
          </span>
          <ChevronDown size={13} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "nav-item active" : "nav-item"}
              onClick={() =>
                n.id === "agents" ? layout.openAgents() : setPage(n.id)
              }
            >
              <n.icon size={17} />
              {n.name}
              {n.id === "brain" && memories.length > 0 && (
                <span className="nav-count">{memories.length}</span>
              )}
              {n.id === "home" && <span className="shortcut">⌘ 1</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="nav-label">
          ACTIVE AI <span>{active ? `${workingCount} working` : "Ready"}</span>
        </div>
        <button
          className="sidebar-agent"
          onClick={() => {
            layout.openAgents();
            if (active) setSelectedRun(active.id);
          }}
        >
          <span className="avatar cline">
            <Mark name="cline" size={15} />
          </span>
          <span>
            Cline
            <small>
              {clineWorking
                ? "Coordinating"
                : `Model · ${data.settings.modelId || "Not configured"}`}
            </small>
          </span>
          <i className={clineWorking ? "dot live" : "dot"} />
        </button>
        <button
          className="sidebar-agent"
          onClick={() => {
            layout.openAgents();
            if (active) setSelectedRun(active.id);
          }}
        >
          <span className="avatar codex">
            <Mark name="codex" size={15} />
          </span>
          <span>
            Codex
            <small>{codexWorking ? "Writing a response…" : "Local CLI"}</small>
          </span>
          <i className={codexWorking ? "dot live" : "dot"} />
        </button>
        <button className="add-agent" onClick={() => setPage("connections")}>
          <Plus size={14} /> Manage connections
        </button>
        <div className="sidebar-divider" />
        <div className="nav-label">
          SECOND BRAIN{" "}
          <button
            title="New memory"
            aria-label="New memory"
            onClick={() => {
              openDocument();
            }}
          >
            <Plus size={13} />
          </button>
        </div>
        <div className="sidebar-document-search">
          <Search size={12} />
          <input
            aria-label="Search documents"
            placeholder="Find a document…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="sidebar-memory-list">
          {data.brain
            .filter(
              (m) =>
                m.project === data.settings.project &&
                (m.title + m.body).toLowerCase().includes(filter.toLowerCase()),
            )
            .map((memory) => (
              <button
                key={memory.id}
                className="sidebar-memory"
                onClick={() => {
                  setPage("brain");
                  openDocument(memory);
                }}
              >
                <FileText size={13} />
                <span>{memory.title}</span>
              </button>
            ))}
          {!data.brain.some((m) => m.project === data.settings.project) && (
            <p className="sidebar-empty">
              Add a note. Give your agents a place to start.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={16} />
            <span>
              Your brain stays local
              <small>You choose what agents receive.</small>
            </span>
          </div>
          <button className="profile" onClick={() => setPage("connections")}>
            <span className="profile-avatar">Y</span>
            <span>
              Your workspace<small>macOS · Local first</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      <ResizeHandle
        direction="col"
        getValue={() => layout.leftPanelWidth}
        onResize={layout.setLeftPanelWidth}
      />
      <div className="workspace-column">
        <div className="workspace-titlebar" data-tauri-drag-region>
          <PanelLeft size={14} />
          <span>{data.settings.project}</span>
          <button
            className="icon-button"
            aria-label="Toggle AI panel"
            title="Toggle AI panel"
            onClick={layout.toggleRightPanel}
          >
            <Bot size={16} />
          </button>
          <span className="titlebar-caption">
            Your agents. One shared brain.
          </span>
          <button
            className="icon-button"
            aria-label="Toggle terminal"
            title="Toggle terminal (⌘J)"
            onClick={layout.toggleBottomPanel}
          >
            <TerminalSquare size={15} />
          </button>
        </div>
        <div className="workspace-body">
          <main className={page === "brain" ? "main document-main" : "main"}>
            <header className="topbar" data-tauri-drag-region>
              <div className="breadcrumb">
                Workspace <ChevronRight size={12} />{" "}
                <span>{nav.find((n) => n.id === page)?.name}</span>
              </div>
              <div className="topbar-right">
                <span className="local-status">
                  <i className={native ? "dot live" : "dot"} />
                  {native ? "Local workspace" : "Browser preview"}
                </span>
                <button
                  className="icon-button"
                  title="Add memory"
                  onClick={() => {
                    openDocument();
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </header>
            {error && (
              <div className="error-banner">
                <span>{error}</span>
                <button
                  onClick={() => {
                    setPage("connections");
                    setError("");
                  }}
                >
                  Connections <ArrowRight size={13} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {page === "home" && (
              <div className="overview page-content">
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">
                      <span className="tiny-star">✳</span> A LITTLE MORE THAN A
                      SECOND BRAIN
                    </div>
                    <h1>
                      Your agents.
                      <br />
                      <span>One shared brain.</span>
                    </h1>
                    <p>
                      A place for your AI to remember, collaborate, and get
                      things done.
                    </p>
                  </div>
                  <button className="button primary" onClick={() => newRun()}>
                    <Plus size={16} /> New task
                  </button>
                </div>
                <div className="section-title">
                  <h2>Put your brain to work</h2>
                  <button
                    className="text-button"
                    onClick={() => setPage("automations")}
                  >
                    All automations <ArrowRight size={14} />
                  </button>
                </div>
                <div className="workflow-grid">
                  <button
                    className="workflow-card"
                    onClick={() => newRun("issue")}
                  >
                    <span className="workflow-symbol peach">
                      <GitBranch size={20} />
                    </span>
                    <span className="card-kicker">BUILD WITH CONTEXT</span>
                    <h3>From issue to action</h3>
                    <p>
                      Your project memory. Fresh research.
                      <br />
                      An actionable GitHub response.
                    </p>
                    <span className="card-footer">
                      <span>
                        <Mark name="cline" size={13} />
                        <span className="chain-line" />
                        <Mark name="codex" size={13} />
                        <span className="chain-line" />
                        <Github size={14} />
                      </span>
                      <ArrowUpRight size={18} />
                    </span>
                  </button>
                  <button
                    className="workflow-card"
                    onClick={() => newRun("daily")}
                  >
                    <span className="workflow-symbol blue">
                      <Sparkles size={20} />
                    </span>
                    <span className="card-kicker">START ONE STEP AHEAD</span>
                    <h3>Your daily project brief</h3>
                    <p>
                      Catch up on the issue, surface what matters,
                      <br />
                      and know your next move.
                    </p>
                    <span className="card-footer">
                      <span>
                        <Clock3 size={13} /> Run now or schedule daily
                      </span>
                      <ArrowUpRight size={18} />
                    </span>
                  </button>
                  <button
                    className="workflow-card memory-card"
                    onClick={() => {
                      openDocument();
                    }}
                  >
                    <span className="workflow-symbol green">
                      <Brain size={20} />
                    </span>
                    <span className="card-kicker">MAKE IT YOURS</span>
                    <h3>Give your agents context</h3>
                    <p>
                      A decision, a project note, a constraint.
                      <br />
                      Remember it once. Use it everywhere.
                    </p>
                    <span className="card-footer">
                      <span>{memories.length} active memories</span>
                      <Plus size={18} />
                    </span>
                  </button>
                </div>
                <div className="section-title activity-title">
                  <h2>
                    Recent activity{" "}
                    <span className="count-label">{recent.length}</span>
                  </h2>
                  <span className="muted small">Across your agents</span>
                </div>
                <div className="activity-list">
                  {recent.length ? (
                    recent.slice(0, 5).map((r) => (
                      <button
                        key={r.id}
                        className="activity-row"
                        onClick={() => setSelectedRun(r.id)}
                      >
                        <span className={`run-icon ${r.status}`}>
                          <GitBranch size={17} />
                        </span>
                        <span className="activity-name">
                          {r.title}
                          <small>
                            {r.issue
                              ? `${r.issue.owner}/${r.issue.repo} · #${r.issue.issue_number}`
                              : (r.document?.title ?? "Document task")}
                          </small>
                        </span>
                        <Status value={r.status} />
                        <time>{date(r.createdAt)}</time>
                        <ChevronRight size={16} />
                      </button>
                    ))
                  ) : (
                    <div className="empty-inline">
                      <span className="empty-orbit">
                        <Workflow size={21} />
                      </span>
                      <span>
                        No tasks yet.
                        <small>
                          Your first task is where the shared memory starts.
                        </small>
                      </span>
                      <button className="text-button" onClick={() => newRun()}>
                        Start a task <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {page === "agents" && (
              <div className="page-content agents-page">
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">YOUR LOCAL TEAM</div>
                    <h1>Active AI</h1>
                    <p>One project. Shared memory. A clear handoff.</p>
                  </div>
                  <button className="button primary" onClick={() => newRun()}>
                    <Plus size={15} /> New task
                  </button>
                </div>
                <div className="agent-workbench">
                  {[
                    {
                      name: "Cline",
                      mark: "cline",
                      role: "Research & orchestration",
                      working: !!clineWorking,
                    },
                    {
                      name: "Codex",
                      mark: "codex",
                      role: "Drafts with your local CLI",
                      working: codexWorking,
                    },
                  ].map((a) => (
                    <button
                      className="agent-workbench-card"
                      key={a.name}
                      onClick={() =>
                        active ? setSelectedRun(active.id) : setAgent(a.mark)
                      }
                    >
                      <span className={"avatar " + a.mark}>
                        <Mark name={a.mark} size={22} />
                      </span>
                      <h2>{a.name}</h2>
                      <p>{a.role}</p>
                      <span className="agent-state">
                        <i className={a.working ? "dot live" : "dot"} />
                        {a.working ? "Working · " + active?.stage : "Idle"}
                      </span>
                      <small>{memories.length} active memories available</small>
                    </button>
                  ))}
                </div>
                <div className="section-heading">
                  <h2>Task history</h2>
                  <span className="muted small">{recent.length} runs</span>
                </div>
                <div className="agent-task-list">
                  {recent.map((r) => (
                    <button key={r.id} onClick={() => setSelectedRun(r.id)}>
                      <FileText size={15} />
                      <span>
                        {r.title}
                        <small>{date(r.createdAt)}</small>
                      </span>
                      <span className="status">{r.status}</span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                  {!recent.length && (
                    <div className="empty-state">
                      <Brain size={24} />
                      <h2>Your team is ready for its first task.</h2>
                      <p>Add a project memory, then choose an issue.</p>
                      <button className="button" onClick={() => newRun()}>
                        Start a task <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!loading && (
              <div
                className="document-host"
                style={{ display: page === "brain" ? "flex" : "none" }}
              >
                <Documents
                  runs={data.runs}
                  key={data.settings.project}
                  items={data.brain.filter(
                    (m) => m.project === data.settings.project,
                  )}
                  project={data.settings.project}
                  request={documentRequest}
                  onSave={(input) => act<BrainItem>("brain.save", input)}
                  onRun={(id) => {
                    setSelectedRun(id);
                    if (
                      data.runs.find((r) => r.id === id)?.template ===
                      "document"
                    )
                      layout.openAgents();
                  }}
                  onCurrent={setCurrentDocument}
                  onReveal={() => setPage("brain")}
                />
              </div>
            )}
            {page === "automations" && (
              <AutomationPage
                data={data}
                act={act}
                onRun={(r) => setSelectedRun(r.id)}
                onError={setError}
              />
            )}
            {page === "connections" && (
              <Connections
                data={data}
                refresh={refresh}
                notify={setToast}
                onError={setError}
              />
            )}
          </main>
          {layout.rightVisible && !layout.overlay && (
            <ResizeHandle
              label="Resize AI panel"
              direction="col"
              reverse
              getValue={() => layout.rightPanelWidth}
              onResize={layout.setRightPanelWidth}
            />
          )}
          {layout.overlay && layout.rightVisible && (
            <button
              className="inspector-backdrop"
              aria-label="Close AI panel"
              onClick={layout.toggleRightPanel}
            />
          )}
          <aside
            className={`workspace-right-rail ${layout.overlay ? "inspector-overlay" : ""}`}
            aria-label="Workspace inspector"
            style={{
              width: layout.rightPanelWidth,
              flexBasis: layout.rightPanelWidth,
              display: layout.rightVisible ? "flex" : "none",
            }}
          >
            <header className="inspector-tabs">
              <button
                className={layout.inspectorTab === "agents" ? "selected" : ""}
                onClick={() => layout.setInspectorTab("agents")}
              >
                Agents <small>{activeRuns.length || ""}</small>
              </button>
              <button
                className={layout.inspectorTab === "document" ? "selected" : ""}
                onClick={() => layout.setInspectorTab("document")}
              >
                Document
              </button>
              <button
                className="icon-button"
                aria-label="Close inspector"
                onClick={layout.toggleRightPanel}
              >
                <X size={14} />
              </button>
            </header>
            <div
              className="agents-inspector"
              style={{
                display: layout.inspectorTab === "agents" ? "flex" : "none",
              }}
            >
              <CodexWork
                key={data.settings.project}
                document={currentDocument}
                project={data.settings.project}
                runs={recent}
                brain={data.brain}
                selected={selectedRun}
                selectedAgent={selectedAgent}
                act={act}
                onSelect={setSelectedRun}
                onOpen={openDocument}
                monitor={
                  <AgentMonitor
                    runs={recent.filter(
                      (r) =>
                        r.id ===
                        (selectedRun ??
                          recent.find((r) => r.template === "document")?.id),
                    )}
                    visible={
                      layout.rightVisible && layout.inspectorTab === "agents"
                    }
                    expanded={layout.boardExpanded}
                    onExpand={layout.toggleBoard}
                    selectedAgent={selectedAgent}
                    onSelect={(id, agentId) => {
                      setSelectedRun(id);
                      setSelectedAgent(agentId ?? null);
                    }}
                    onOpen={() =>
                      document
                        .getElementById("sidebar-codex-instruction")
                        ?.focus()
                    }
                  />
                }
              />
            </div>
            <div
              className="document-inspector-pane"
              hidden={layout.inspectorTab !== "document"}
            >
              {currentDocument ? (
                <DocumentInspector
                  body={currentDocument.body}
                  title={currentDocument.title}
                  id={currentDocument.id}
                  items={data.brain.filter(
                    (m) => m.project === data.settings.project,
                  )}
                  onOpen={openDocument}
                />
              ) : (
                <p className="inspector-empty">
                  Open a document to see its outline and links.
                </p>
              )}
            </div>
          </aside>
        </div>
        {layout.bottomPanelOpen && (
          <ResizeHandle
            direction="row"
            getValue={() => layout.bottomPanelHeight}
            onResize={layout.setBottomPanelHeight}
            reverse
          />
        )}
        <div
          className="bottom-panel"
          style={{
            height: layout.bottomPanelHeight,
            display: layout.bottomPanelOpen ? "flex" : "none",
          }}
        >
          <TerminalPanel
            visible={layout.bottomPanelOpen}
            toggle={layout.toggleBottomPanel}
            expanded={layout.terminalExpanded}
            onExpand={layout.toggleTerminalExpanded}
          />
        </div>
        <footer className="workspace-statusbar">
          <span>
            <i className="dot live" /> {data.settings.project}
          </span>
          <span>
            {memories.length} memories ·{" "}
            {active
              ? `${workingCount} agents · ${activeRuns.length} workflows`
              : "Agents idle"}
          </span>
          <button onClick={layout.toggleBottomPanel}>
            <TerminalSquare size={12} /> Terminal <kbd>⌘J</kbd>
          </button>
        </footer>
      </div>
      {loading && (
        <div className="loading-badge">
          <Loader2 className="spin" size={15} /> Opening your workspace
        </div>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {startOpen && (
        <StartDialog
          project={data.settings.project}
          template={runTemplate}
          active={activeRuns.length >= 8}
          onClose={() => setStartOpen(false)}
          onStart={async (issueUrl) => {
            const r = await act<Run>("run.start", {
              project: data.settings.project,
              issueUrl,
              template: runTemplate,
            });
            setSelectedRun(r.id);
            setStartOpen(false);
          }}
        />
      )}
      {run && run.template !== "document" && (
        <RunPanel
          run={run}
          proposal={data.proposals.find((p) => p.id === run.proposalId)}
          memory={data.brain.find((m) => m.id === run.memoryId)}
          onClose={() => setSelectedRun(null)}
          act={act}
          notify={setToast}
        />
      )}
      {agent && (
        <Modal
          title={
            agent === "cline"
              ? "Cline · Research & orchestration"
              : agent === "codex"
                ? "Codex · Your local agent"
                : `${agent.charAt(0).toUpperCase() + agent.slice(1)} · Collection preview`
          }
          onClose={() => setAgent(null)}
        >
          <div className="agent-detail">
            <span className={`big-agent ${agent}`}>
              <Mark name={agent} size={42} />
            </span>
            <h3>
              {agent === "cline"
                ? "Connect the dots."
                : agent === "codex"
                  ? "Bring your own superpowers."
                  : "A growing collection."}
            </h3>
            <p>
              {agent === "cline"
                ? "Cline uses your selected model to research an issue with Parallel, then hands the shared context to Codex."
                : agent === "codex"
                  ? "Connect your installed Codex CLI. ClineBrain passes selected project memories and sources into a new read-only task."
                  : "This original Exawatt token is a visual preview. This provider is not connected or supported in the current MVP."}
            </p>
            <button
              className="button primary"
              onClick={() => {
                setAgent(null);
                setPage("connections");
              }}
            >
              Manage connections <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value}`}>
      <i />
      {(
        {
          review: "Needs review",
          running: "Working",
          completed: "Complete",
          active: "Active",
          proposed: "Suggested",
          archived: "Archived",
          failed: "Failed",
          cancelled: "Cancelled",
          interrupted: "Interrupted",
          pending: "Ready to review",
          uncertain: "Check publication",
          published: "Published",
        } as Record<string, string>
      )[value] ?? value}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="button secondary" onClick={onClick}>
        {action}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function StartDialog({
  project,
  template,
  active,
  onClose,
  onStart,
}: {
  project: string;
  template: string;
  active: boolean;
  onClose: () => void;
  onStart: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={
        template === "daily"
          ? "Your daily project brief"
          : "From issue to action"
      }
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onStart(url);
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="dialog-flow">
          <span>
            <Mark name="cline" /> Cline
          </span>
          <ArrowRight size={15} />
          <span>
            <Mark name="codex" /> Codex
          </span>
          <ArrowRight size={15} />
          <span>
            <Github size={19} /> GitHub
          </span>
        </div>
        <p className="muted">
          Start with an issue. Your agents will bring the memory and research.
        </p>
        <label>
          Project
          <input value={project} disabled />
        </label>
        <label>
          GitHub issue URL
          <input
            autoFocus
            required
            type="url"
            placeholder="https://github.com/owner/repo/issues/123"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <div className="info-note">
          <ShieldCheck size={17} />
          <span>
            The selected issue and active project memories are sent to your
            configured agents. Publishing always waits for your review.
          </span>
        </div>
        {error && <p className="inline-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || active}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={14} />}{" "}
            {active ? "A task is running" : "Start task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function RunPanel({
  run,
  proposal,
  memory,
  onClose,
  act,
  notify,
}: {
  run: Run;
  proposal?: Proposal;
  memory?: BrainItem;
  onClose: () => void;
  act: <T = unknown>(method: string, p?: unknown) => Promise<T>;
  notify: (s: string) => void;
}) {
  const [body, setBody] = useState(proposal?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("response");
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  useEffect(() => {
    setBody(proposal?.body ?? "");
    setReview(false);
  }, [proposal?.revision]);
  async function doAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="run-panel">
        <header>
          <span className="eyebrow">TASK WORKSPACE</span>
          <button
            className="icon-button"
            aria-label="Close task"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <h2>{run.title}</h2>
        <div className="run-meta">
          <Status value={run.status} />
          <button
            className="text-button"
            onClick={() => external(run.issue.url)}
          >
            #{run.issue.issue_number}
            <ExternalLink size={12} />
          </button>
        </div>
        <div className="tabs">
          {["response", "activity", "context"].map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t === "context" ? `Context (${run.context.length})` : t}
            </button>
          ))}
        </div>
        {tab === "response" && (
          <>
            {proposal ? (
              <>
                <div className="response-label">
                  <Github size={16} /> Response to {run.issue.owner}/
                  {run.issue.repo}
                </div>
                <textarea
                  className="response-editor"
                  aria-label="GitHub response"
                  value={body}
                  disabled={proposal.status !== "pending" || busy}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setReview(false);
                  }}
                />
                <div className="review-controls">
                  {body !== proposal.body ? (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        doAction(() =>
                          act("proposal.edit", {
                            id: proposal.id,
                            revision: proposal.revision,
                            body,
                          }),
                        )
                      }
                    >
                      Save changes for review
                    </button>
                  ) : proposal.status === "pending" ? (
                    <>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={review}
                          onChange={(e) => setReview(e.target.checked)}
                        />{" "}
                        I reviewed this response and its destination.
                      </label>
                      <button
                        className="button primary full"
                        disabled={!review || busy}
                        onClick={() =>
                          doAction(() =>
                            act("proposal.publish", {
                              id: proposal.id,
                              revision: proposal.revision,
                            }),
                          )
                        }
                      >
                        {busy ? (
                          <Loader2 className="spin" size={16} />
                        ) : (
                          <Github size={16} />
                        )}{" "}
                        Approve & publish comment
                      </button>
                    </>
                  ) : proposal.status === "uncertain" ? (
                    <button
                      className="button secondary full"
                      disabled={busy}
                      onClick={() =>
                        doAction(() =>
                          act("proposal.publish", {
                            id: proposal.id,
                            revision: proposal.revision,
                          }),
                        )
                      }
                    >
                      Check publication — no resend
                    </button>
                  ) : proposal.url ? (
                    <button
                      className="button primary full"
                      onClick={() => external(proposal.url!)}
                    >
                      View verified GitHub comment <ExternalLink size={15} />
                    </button>
                  ) : (
                    <span className="muted">Publication in progress…</span>
                  )}
                </div>
                {memory && (
                  <div className="remember-card">
                    <Brain size={22} />
                    <div>
                      <h3>Worth remembering?</h3>
                      <p>
                        {memory.status === "active"
                          ? "This response is available to future tasks."
                          : "Keep the response as shared project memory."}
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      disabled={busy || memory.status !== "proposed"}
                      onClick={() =>
                        doAction(async () => {
                          await act("brain.save", {
                            ...memory,
                            status: "active",
                            body: proposal.body,
                          });
                          notify("Memory added to your shared brain");
                        })
                      }
                    >
                      {memory.status === "active" ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}{" "}
                      {memory.status === "active" ? "Saved" : "Keep"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="run-wait">
                {run.status === "running" ? (
                  <Loader2 className="spin" size={30} />
                ) : (
                  <Circle size={30} />
                )}
                <h3>
                  {run.status === "running"
                    ? "Your agents are on it."
                    : "This task did not finish."}
                </h3>
                <p>
                  {run.error ??
                    run.events.at(-1)?.message ??
                    "Gathering the shared context…"}
                </p>
                {run.status === "running" && (
                  <button
                    className="button secondary"
                    onClick={() =>
                      doAction(() => act("run.cancel", { id: run.id }))
                    }
                  >
                    <Square size={13} /> Cancel task
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {tab === "activity" && (
          <div className="timeline">
            {run.events.map((e) => (
              <div key={e.seq}>
                <span className={`timeline-dot ${e.agent}`} />
                <div>
                  <span className="timeline-agent">
                    {e.agent}
                    <time>{new Date(e.at).toLocaleTimeString()}</time>
                  </span>
                  <p>{e.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "context" && (
          <div className="context-list">
            <h3>Shared memory snapshot</h3>
            <p className="muted small">
              The exact context selected for this task, shared across agents.
            </p>
            {run.context.length ? (
              run.context.map((m) => (
                <details key={m.id}>
                  <summary>
                    <FileText size={15} />
                    {m.title}
                    <ChevronDown size={14} />
                  </summary>
                  <p>{m.body}</p>
                </details>
              ))
            ) : (
              <p className="empty-copy">
                No active memories were available for this project.
              </p>
            )}
            <h3>Research sources</h3>
            {run.sources.map((s, i) => (
              <div className="source-card" key={i}>
                <button onClick={() => external(s.url)}>
                  {s.title}
                  <ExternalLink size={13} />
                </button>
                <p>{s.excerpt}</p>
              </div>
            ))}
          </div>
        )}
        {error && <p className="inline-error">{error}</p>}
      </aside>
    </div>
  );
}
function AutomationPage({
  data,
  act,
  onRun,
  onError,
}: {
  data: Snapshot;
  act: <T = unknown>(m: string, p?: unknown) => Promise<T>;
  onRun: (r: Run) => void;
  onError: (s: string) => void;
}) {
  const [template, setTemplate] = useState<"issue" | "daily" | null>(null);
  const [url, setUrl] = useState("");
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [busy, setBusy] = useState(false);
  return (
    <div className="page-content">
      <div className="page-heading compact">
        <div>
          <div className="eyebrow">LESS REMINDING. MORE DOING.</div>
          <h1>
            Make it a routine<span className="title-dot">.</span>
          </h1>
          <p>Set the rhythm. Your agents bring the context.</p>
        </div>
      </div>
      <div className="automation-templates">
        {(["issue", "daily"] as const).map((t) => (
          <button
            key={t}
            className="automation-template"
            onClick={() => setTemplate(t)}
          >
            <span
              className={`workflow-symbol ${t === "issue" ? "peach" : "blue"}`}
            >
              {t === "issue" ? <GitBranch /> : <Sparkles />}
            </span>
            <h3>{t === "issue" ? "Issue Brief" : "Daily Project Brief"}</h3>
            <p>
              {t === "issue"
                ? "Research an issue and draft an actionable response."
                : "Read the issue and recent comments, then prepare your next steps."}
            </p>
            <span className="text-button">
              Create automation <Plus size={16} />
            </span>
          </button>
        ))}
      </div>
      <div className="section-title">
        <h2>Your routines</h2>
        <span className="small muted">Runs while ClineBrain is open</span>
      </div>
      {data.automations.length ? (
        data.automations.map((a) => (
          <div className="automation-row" key={a.id}>
            <Clock3 size={22} />
            <div>
              <h3>
                {a.template === "issue" ? "Issue Brief" : "Daily Project Brief"}
              </h3>
              <p>
                {a.time} daily · {a.timezone} · {a.project}
              </p>
              <small className={a.status === "missed" ? "warning" : ""}>
                {a.status === "missed"
                  ? "Missed while app was closed or busy — run manually to catch up"
                  : a.issueUrl}
              </small>
            </div>
            <button
              className={`toggle ${a.enabled ? "on" : ""}`}
              aria-label={a.enabled ? "Pause automation" : "Enable automation"}
              onClick={() =>
                act("automation.save", { ...a, enabled: !a.enabled }).catch(
                  () => {},
                )
              }
            >
              <span />
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  onRun(await act<Run>("run.start", a));
                } catch (e) {
                  onError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Play size={13} /> Run now
            </button>
            {a.lastRunId && (
              <button
                className="text-button"
                onClick={() => {
                  const r = data.runs.find((r) => r.id === a.lastRunId);
                  if (r) onRun(r);
                }}
              >
                Last result
              </button>
            )}
          </div>
        ))
      ) : (
        <div className="empty-inline">
          <Clock3 size={25} />
          <span>
            Your next routine starts here.
            <small>
              Choose a template above. Every published response still needs your
              review.
            </small>
          </span>
        </div>
      )}
      {template && (
        <Modal title="Create a daily routine" onClose={() => setTemplate(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await act<Automation>("automation.save", {
                  template,
                  project: data.settings.project,
                  issueUrl: url,
                  time,
                  timezone,
                  enabled: true,
                });
                setTemplate(null);
              } catch (e) {
                onError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              GitHub issue URL
              <input
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/issues/123"
              />
            </label>
            <div className="form-row">
              <label>
                Time
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <label>
                Timezone
                <input
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
            </div>
            <div className="info-note">
              <Clock3 size={18} />
              <span>
                Runs while your Mac is awake and the app is open. Missed runs
                are marked for you to catch up manually.
              </span>
            </div>
            <div className="modal-actions">
              <button className="button primary" disabled={busy}>
                <Plus size={15} /> Create routine
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
