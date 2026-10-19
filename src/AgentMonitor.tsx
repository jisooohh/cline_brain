import { Mark } from "./Mark";
import ReactMarkdown from "react-markdown";
import { agentColor } from "./agentAppearance";
import { lazy, Suspense, useEffect, useRef, type CSSProperties } from "react";
import { Activity, Maximize2, Minimize2, CircleCheck } from "lucide-react";
import type { Run } from "./types";
const Board = lazy(() => import("./Board"));
export default function AgentMonitor({
  runs,
  onSelect,
  visible,
  expanded,
  onExpand,
  selectedAgent,
}: {
  runs: Run[];
  onSelect: (id: string, agentId?: string) => void;
  onOpen: () => void;
  visible: boolean;
  expanded: boolean;
  onExpand: () => void;
  selectedAgent: string | null;
}) {
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selectedAgent) detailRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [selectedAgent]);
  const selectedRun = runs.find(r => r.agents?.some(n => n.id === selectedAgent));
  const selectedNode = selectedRun?.agents?.find(n => n.id === selectedAgent);
  const latestEvent = selectedRun?.events.filter(e => e.agent === selectedAgent).at(-1);
  const nodes = runs.flatMap((run) =>
    (
      run.agents ?? [
        {
          id: run.id,
          role: run.stage === "draft" ? "Codex" : "Cline",
          status: run.status,
          model: "",
          mark: run.stage === "draft" ? "codex" : "cline",
        },
      ]
    ).map((n) => ({ ...n, runId: run.id })),
  );
  const working = nodes.filter((n) => n.status === "running").length;
  return (
    <section className="agent-monitor" aria-label="Live agent fleet">
      <header>
        <Activity size={12} />
        <span>Agent studio</span>
        <span className="monitor-state">
          {working
            ? `${working} working`
            : (runs[0]?.status ?? "No task selected")}
        </span>
        <button
          className="icon-button"
          onClick={onExpand}
          aria-label={expanded ? "Reduce agent board" : "Expand agent board"}
        >
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </header>
      <div
        className="agent-monitor-scene"
        style={{ height: expanded ? 360 : 220 }}
        aria-hidden="true"
      >
        {visible && (
          <Suspense
            fallback={<div className="monitor-loading">Opening studio…</div>}
          >
            <Board
              runs={runs}
              onSelect={onSelect}
              selectedAgent={selectedAgent}
            />
          </Suspense>
        )}
      </div>
      <div className="fleet-key-legend">
        {nodes.map((n) => (
          <button
            key={n.id}
            style={{ "--agent-color": (n.status === "completed" ? "#969c99" : agentColor(n.mark)) } as CSSProperties}
            aria-pressed={selectedAgent === n.id}
            onClick={() => onSelect(n.runId, n.id)}
            title={`${n.role} · ${n.model} · ${n.status}`}
          >
            {n.status === "completed" ? <CircleCheck className="agent-done" size={14} /> : <i className={`agent-status-dot ${n.status}`} />}
            <Mark name={n.mark ?? "codex"} size={12} />
            <span>{n.role}</span>
            <small>{n.status === "completed" ? "Done" : n.status}</small>
          </button>
        ))}
      </div>
      {selectedNode && (
        <section ref={detailRef} className="agent-focus-card" aria-label="Selected agent details" style={{ "--agent-color": (selectedNode.status === "completed" ? "#969c99" : agentColor(selectedNode.mark)) } as CSSProperties}>
          <header><Mark name={selectedNode.mark ?? "codex"} size={18} /><strong>{selectedNode.role}</strong><span className="agent-state-label">{selectedNode.status === "completed" && <CircleCheck size={14} />}{selectedNode.status === "completed" ? "Done" : selectedNode.status}</span></header>
          <small>{selectedNode.model}{selectedNode.backend === "cline" ? " · via Cline" : " · Local CLI"}</small>
          <h4>Current task</h4>
          <p>{selectedNode.task ?? "Combine the team’s reports into the final document."}</p>
          <p className="agent-focus-request">{selectedRun?.instruction ?? selectedRun?.title}</p>
          {latestEvent && <small>{latestEvent.message}</small>}
          <h4>Response</h4>
          {selectedNode.output ? <div className="agent-focus-response"><ReactMarkdown>{selectedNode.output}</ReactMarkdown></div> : <p>{selectedNode.status === "running" ? "Working on the task. The response appears here when received." : selectedNode.status === "waiting" || selectedNode.status === "queued" ? "Waiting to start." : "No response was produced."}</p>}
          {selectedNode.error && <p className="inline-error">{selectedNode.error}</p>}
        </section>
      )}
      {!nodes.length && (
        <p className="inspector-empty">Give your team a task below.</p>
      )}
    </section>
  );
}
