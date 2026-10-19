import budgetModels from "../shared/budget-models.json";
import { Mark } from "./Mark";
import Select from "./ui/Select";
import { useRef, useState, type ReactNode } from "react";
import { Play, Square, FileText, ArrowUpRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { external } from "./bridge";
import type { BrainItem, Run } from "./types";
export default function CodexWork({
  document,
  project,
  runs,
  brain,
  selected,
  act,
  onSelect,
  onOpen,
  monitor,
  selectedAgent,
}: {
  monitor: ReactNode;
  selectedAgent: string | null;
  document: Run["document"] | null;
  project: string;
  runs: Run[];
  brain: BrainItem[];
  selected: string | null;
  act: <T = unknown>(method: string, p?: unknown) => Promise<T>;
  onSelect: (id: string) => void;
  onOpen: (item: BrainItem) => void;
}) {
  const submitting = useRef(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("team");
  const [model, setModel] = useState("gpt-6-luna");
  const [research, setResearch] = useState(false);
  const [workerBackend, setWorkerBackend] = useState("cline");
  const [workerModels, setWorkerModels] = useState(() =>
    Array.from({ length: 6 }, (_, i) => budgetModels[i % budgetModels.length].id),
  );
  const [workers, setWorkers] = useState(6);
  const documentRuns = runs.filter((r) => r.template === "document");
  const run = documentRuns.find((r) => r.id === selected) ?? documentRuns[0];
  const result = brain.find((b) => b.id === run?.memoryId);
  return (
    <section className="codex-work">
      <div className="agent-task-scroll">
        {monitor}
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        {runs.some((r) => r.template !== "document") && (
          <details className="issue-history">
            <summary>GitHub workflows</summary>
            {runs
              .filter((r) => r.template !== "document")
              .map((r) => (
                <button
                  className="text-button"
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                >
                  {r.title} · {r.status}
                </button>
              ))}
          </details>
        )}
        {documentRuns.length > 0 && (
          <label className="team-run-picker">
            Workflows ·{" "}
            {documentRuns.filter((r) => r.status === "running").length} active
            <Select
              aria-label="Selected workflow"
              value={run?.id ?? ""}
              onChange={(e) => onSelect(e.target.value)}
            >
              {documentRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.status} · {r.title}
                </option>
              ))}
            </Select>
          </label>
        )}
        {run && (
          <div className="codex-run">
            <div className="codex-work-heading">
              <h3>{run.title}</h3>
              <span>{run.status}</span>
              {run.status === "running" && (
                <button
                  className="button secondary"
                  onClick={() =>
                    void act("run.cancel", { id: run.id }).catch((e) =>
                      setError(String(e)),
                    )
                  }
                >
                  <Square size={12} /> Cancel
                </button>
              )}
            </div>
            {run.agents && (
              <div className="team-tree" aria-label="Agent team">
                {run.agents.map((node) => (
                  <div
                    key={node.id}
                    className={`team-node ${node.parentId ? "subagent" : "team-lead"}`}
                  >
                    <details
                      key={`${node.id}-${selectedAgent === node.id}`}
                      open={selectedAgent === node.id}
                    >
                      <summary>
                        <i
                          className={
                            node.status === "running" ? "dot live" : "dot"
                          }
                        />
                        <span>
                          {node.role}
                          <Mark name={node.mark ?? "codex"} size={14} />
                          <small>
                            {node.model}
                            {node.backend === "cline" ? " · via Cline" : ""}
                          </small>
                        </span>
                        <em data-status={node.status}>{node.status}</em>
                      </summary>
                      {node.sessionId && (
                        <small>Session {node.sessionId.slice(0, 8)}</small>
                      )}
                      {node.output && <pre>{node.output}</pre>}
                      {node.error && (
                        <p className="inline-error">{node.error}</p>
                      )}
                      {node.parentId &&
                        ["queued", "running"].includes(node.status) && (
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() =>
                              void act("run.cancel", {
                                id: run.id,
                                agentId: node.id,
                              }).catch((e) => setError(String(e)))
                            }
                          >
                            Stop subagent
                          </button>
                        )}
                    </details>
                  </div>
                ))}
              </div>
            )}
            <details>
              <summary>
                Input context · {run.context.length} memories + current document
              </summary>
              <h4>
                {run.document?.title}
                {run.document?.dirty ? " (unsaved snapshot)" : ""}
              </h4>
              <pre>{run.document?.body}</pre>
              {run.context.map((m) => (
                <div key={m.id}>
                  <h4>
                    {m.title} <small>revision {m.revision}</small>
                  </h4>
                  <pre>{m.body}</pre>
                </div>
              ))}
            </details>
            <details className="codex-activity">
              <summary>Activity · {run.events.length} events</summary>
              <ol className="codex-events">
                {run.events.map((e) => (
                  <li key={e.seq}>
                    <span>
                      {run.agents?.find((n) => n.id === e.agent)?.role ??
                        e.agent}
                    </span>
                    {e.message}
                  </li>
                ))}
              </ol>
            </details>
            {run.status === "running" && (
              <p className="codex-live-event" role="status">
                {run.events.at(-1)?.message || "Starting Codex…"}
              </p>
            )}
            {!!run.sources.length && (
              <details>
                <summary>Research sources · {run.sources.length}</summary>
                {run.sources.map((source) => (
                  <button
                    key={source.url}
                    className="text-button"
                    onClick={() =>
                      void external(source.url).catch((e) =>
                        setError(String(e)),
                      )
                    }
                  >
                    {source.title}
                  </button>
                ))}
              </details>
            )}
            {run.error && <p className="inline-error">{run.error}</p>}
            {result && (
              <div className="codex-result">
                <div className="codex-result-heading">
                  Result <span>Saved · {result.status}</span>
                </div>
                <div
                  className="codex-result-preview"
                  tabIndex={0}
                  role="region"
                  aria-label="Codex result preview"
                >
                  <ReactMarkdown
                    skipHtml
                    components={{
                      img: () => null,
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            if (href && /^https?:\/\//.test(href))
                              void external(href);
                          }}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {result.body}
                  </ReactMarkdown>
                </div>
                <button
                  className="button primary"
                  onClick={() => onOpen(result)}
                >
                  <FileText size={14} /> Open result document{" "}
                  <ArrowUpRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="agent-composer">
        <div className="codex-work-heading">
          <h2>Your agent team</h2>
          <span>Codex lead · Cline or local subagents</span>
        </div>
        <div className="codex-context">
          <FileText size={15} />
          <span>
            {document?.project === project
              ? document.title || "Untitled"
              : "Open a document in Second Brain first"}
            <small>
              {document?.dirty
                ? "Current unsaved text will be included"
                : "Current document"}{" "}
              ·{" "}
              {
                brain.filter(
                  (m) => m.project === project && m.status === "active",
                ).length
              }{" "}
              active memories
            </small>
          </span>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              submitting.current ||
              !instruction.trim() ||
              !document?.body.trim() ||
              !document.title.trim() ||
              document.project !== project
            )
              return;
            submitting.current = true;
            setBusy(true);
            setError("");
            try {
              const r = await act<Run>("document.start", {
                project,
                instruction,
                document,
                mode,
                model,
                workers,
                workerBackend,
                workerModels: workerModels.slice(0, workers),
                research,
              });
              onSelect(r.id);
              setInstruction("");
            } catch (e) {
              setError(String(e));
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        >
          <details className="composer-settings">
            <summary>
              Settings ·{" "}
              {workerBackend === "cline" && mode === "team"
                ? "Budget mix"
                : model.replace("gpt-", "GPT-")}{" "}
              · {mode === "team" ? `${workers} workers + lead` : "Solo"}
            </summary>
            <div className="team-config">
              <label>
                Mode
                <Select
                  aria-label="Execution mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="team">Parallel team</option>
                  <option value="solo">Solo agent</option>
                </Select>
              </label>
              <label>
                Lead model
                <Select
                  aria-label="Agent model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="gpt-6-luna">GPT-6 Luna</option>
                  <option value="gpt-6-sol">GPT-6 Sol</option>
                  <option value="gpt-6.1-sol">GPT-6.1 Sol</option>
                </Select>
              </label>
              {mode === "team" && (
                <label>
                  Subagents
                  <Select
                    aria-label="Subagent count"
                    value={workers}
                    onChange={(e) => setWorkers(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} workers + lead
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </div>
            {mode === "team" && (
              <div className="mixed-team-settings">
                <label>
                  Subagent provider
                  <Select
                    aria-label="Subagent provider"
                    value={workerBackend}
                    onChange={(e) => setWorkerBackend(e.target.value)}
                  >
                    <option value="cline">Cline key · budget mix</option>
                    <option value="codex">Local Codex CLI</option>
                  </Select>
                </label>
                {workerBackend === "cline" && (
                  <>
                    <p>
                      Selected document and active memories are sent through
                      Cline to these models. Codex combines their reports.
                    </p>
                    {workerModels.slice(0, workers).map((id, index) => {
                      const chosen = budgetModels.find((m) => m.id === id)!;
                      return (
                        <label className="mixed-model-slot" key={index}>
                          <Mark name={chosen.mark} size={18} />
                          <span>Worker {index + 1}</span>
                          <Select
                            aria-label={`Worker ${index + 1} model`}
                            value={id}
                            onChange={(e) =>
                              setWorkerModels((list) =>
                                list.map((v, i) =>
                                  i === index ? e.target.value : v,
                                ),
                              )
                            }
                          >
                            {budgetModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </Select>
                          <small>
                            Catalog $ {chosen.inputPrice} in /{" "}
                            {chosen.outputPrice} out per 1M tokens
                          </small>
                        </label>
                      );
                    })}
                    <small>
                      Catalog estimate · 2026-10-19. Cline billing and
                      availability apply.
                    </small>
                  </>
                )}
              </div>
            )}
            <label className="team-research">
              <input
                type="checkbox"
                checked={research}
                onChange={(e) => setResearch(e.target.checked)}
              />{" "}
              Web research · Parallel{" "}
              <small>
                Sends your instruction to Parallel; requires a saved key.
              </small>
            </label>
          </details>
          <textarea
            id="sidebar-codex-instruction"
            aria-label="Task for Codex"
            onKeyDown={(e) => {
              if (
                (e.metaKey || e.ctrlKey) &&
                e.key === "Enter" &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="What should your team do with this document?"
            rows={3}
            maxLength={8000}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="codex-actions">
            <span>⌘↵ to run · Saves as a suggested document.</span>
            <button
              className="button primary"
              disabled={
                busy ||
                !instruction.trim() ||
                !document?.body.trim() ||
                !document.title.trim() ||
                document.project !== project
              }
            >
              <Play size={13} />
              {busy
                ? "Starting…"
                : mode === "team"
                  ? "Launch team"
                  : "Run Codex"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
