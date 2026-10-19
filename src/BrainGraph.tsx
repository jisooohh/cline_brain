import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, Search, Network } from "lucide-react";
import type { BrainItem, Run } from "./types";
import {
  buildBrainGraph,
  layoutBrainGraph,
  spreadGraphPoints,
  graphNeighborhood,
} from "./graphModel";
import { constellationLabelCandidates } from "./vendor/kuku/graph/graph_constellation";
import "./vendor/kuku/graph/graph_constellation.css";
import "./brainGraph.css";

export default function BrainGraph({
  items,
  runs,
  onRun,
  project,
  currentId,
  onOpen,
}: {
  items: BrainItem[];
  runs: Run[];
  onRun: (id: string) => void;
  project: string;
  currentId?: string;
  onOpen: (item: BrainItem) => void;
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 580 });
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const graph = useMemo(
    () => buildBrainGraph(items, project, runs),
    [items, project, runs],
  );
  const visible = useMemo(() => {
    const nodes = graph.nodes.filter(
      (n) =>
        (archived || n.status !== "archived") &&
        n.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
    const ids = new Set(nodes.map((n) => n.id));
    return {
      ...graph,
      nodes,
      edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    };
  }, [graph, archived, query]);
  const points = useMemo(
    () => spreadGraphPoints(layoutBrainGraph(visible), size.width, size.height),
    [visible, size],
  );
  const lookup = new Map(points.map((p) => [p.item.id, p]));
  const focus =
    selectedNode && lookup.has(selectedNode) ? selectedNode : hovered;
  const neighbors = graphNeighborhood(visible.edges, focus);
  const selectedItem = visible.nodes.find((n) => n.id === selectedNode);
  const contextEdges = visible.edges.filter(
    (e) => e.source === selectedNode || e.target === selectedNode,
  );
  const labelNodes = visible.nodes.map(item => ({
    id: item.id, filePath: item.id, name: item.title, folder: item.project,
    clusterIndex: item.status === "active" ? 0 : 1,
    linkCount: visible.edges.filter(e => e.source === item.id || e.target === item.id).length,
    isOrphan: !visible.edges.some(e => e.source === item.id || e.target === item.id),
  }));
  const labelCandidates = new Set(constellationLabelCandidates(
    labelNodes, focus ? [...neighbors] : [currentId],
    Math.max(6, Math.floor(size.width / 55)), view.zoom >= 0.85,
  ));
  const labels = new Map<string, number>();
  const boxes: { x: number; y: number; width: number }[] = [];
  for (const point of [...points].sort(
    (a, b) => Number(b.item.id === focus) - Number(a.item.id === focus),
  )) {
    if (!labelCandidates.has(point.item.id)) continue;
    const width = Math.min(point.item.title.length, 32) * 5.8;
    for (const offset of [28, -22, 44, -38]) {
      const box = { x: point.x - width / 2, y: point.y + offset, width };
      const touchesLabel = boxes.some(
        (b) =>
          Math.abs(b.y - box.y) < 16 &&
          b.x < box.x + box.width + 8 &&
          box.x < b.x + b.width + 8,
      );
      const touchesNode = points.some(
        (p) =>
          p.x + 12 > box.x &&
          p.x - 12 < box.x + box.width &&
          p.y + 12 > box.y - 10 &&
          p.y - 12 < box.y + 3,
      );
      if (!touchesLabel && !touchesNode) {
        labels.set(point.item.id, offset);
        boxes.push(box);
        break;
      }
    }
    if (point.item.id === focus && !labels.has(point.item.id))
      labels.set(point.item.id, 28);
  }

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    // Kuku 2D wheel normalization and cursor-anchored exponential zoom.
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
      const factor = Math.exp(-delta * 0.0018);
      const units = size.width / rect.width;
      const x = (event.clientX - rect.left - rect.width / 2) * units;
      const y = (event.clientY - rect.top - rect.height / 2) * units;
      setView((v) => {
        const next = Math.min(3, Math.max(0.4, v.zoom * factor));
        const ratio = next / v.zoom;
        return {
          zoom: next,
          x: x - (x - v.x) * ratio,
          y: y - (y - v.y) * ratio,
        };
      });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [size.width, points.length]);
  const edgeId = (edge: (typeof graph.edges)[number]) =>
    `${edge.kind ?? "wiki"}:${edge.source}:${edge.target}`;
  const inspected = graph.edges.find((edge) => edgeId(edge) === selectedEdge);
  const zoom = (factor: number) =>
    setView((v) => ({
      ...v,
      zoom: Math.min(3, Math.max(0.4, v.zoom * factor)),
    }));
  return (
    <section
      className="brain-graph"
      data-kuku-constellation="true"
      aria-label="Second Brain graph"
    >
      <header className="brain-graph-header kuku-constellation-header">
        <div>
          <Network size={17} />
          <strong>Knowledge graph</strong>
          <span>
            {visible.nodes.length} documents · {visible.edges.length} links
          </span>
        </div>
        <label>
          <Search size={14} />
          <input
            aria-label="Search graph"
            placeholder="Find a document…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setView({ x: 0, y: 0, zoom: 1 });
            }}
          />
        </label>
      </header>
      <div
        ref={canvas}
        className="brain-graph-canvas"
        data-kuku-constellation-canvas="true"
        onDragStart={(e) => e.preventDefault()}
      >
        {!points.length ? (
          <div className="brain-graph-empty">
            <Network size={32} />
            <h3>
              {items.length ? "No matching documents" : "Your ideas start here"}
            </h3>
            <p>
              {items.length
                ? "Try another search or include archived documents."
                : "Save a document to see it in your graph."}
            </p>
          </div>
        ) : (
          <svg
            ref={svg}
            viewBox={`${-size.width / 2} ${-size.height / 2} ${size.width} ${size.height}`}
            aria-label="Document connections"
            onPointerDown={(e) => {
              if ((e.target as Element).closest("[data-node], [data-edge]"))
                return;
              drag.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const scale = size.width / rect.width;
              const dx = (e.clientX - drag.current.x) * scale,
                dy = (e.clientY - drag.current.y) * scale;
              setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <defs>
              <marker
                id="context-arrow"
                viewBox="0 0 10 10"
                refX="21"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ad93e2" />
              </marker>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
              {visible.edges.map((edge) => {
                const a = lookup.get(edge.source)!,
                  b = lookup.get(edge.target)!;
                const description =
                  edge.kind === "context"
                    ? `${a.item.title} → ${b.item.title}: ${edge.evidence!.map((e) => `${e.role === "memory" ? "Read memory" : "Input document"}${e.dirty ? " (unsaved draft)" : ""}, revision ${e.revision ?? "unavailable"}`).join("; ")}`
                    : `${a.item.title} ↔ ${b.item.title}: wiki link`;
                return (
                  <g
                    key={edgeId(edge)}
                    data-edge
                    role="button"
                    tabIndex={0}
                    aria-label={description}
                    className={`graph-edge ${focus && edge.source !== focus && edge.target !== focus ? "dimmed" : ""}`}
                    onClick={() => setSelectedEdge(edgeId(edge))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedEdge(edgeId(edge));
                      }
                    }}
                  >
                    <title>{description}</title>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className="edge-hit"
                    />
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      markerEnd={
                        edge.kind === "context"
                          ? "url(#context-arrow)"
                          : undefined
                      }
                      className={`${edge.kind === "context" ? "context-edge" : "wiki-edge"} ${edge.source === focus || edge.target === focus || selectedEdge === edgeId(edge) ? "connected" : ""}`}
                    />
                  </g>
                );
              })}
              {points.map(({ item, x, y }) => (
                <g
                  key={item.id}
                  data-node
                  role="button"
                  tabIndex={0}
                  aria-label={`Show context for ${item.title}, ${item.status}`}
                  aria-pressed={selectedNode === item.id}
                  transform={`translate(${x} ${y})`}
                  className={`graph-node ${item.status} ${focus === item.id ? "selected" : ""} ${neighbors.has(item.id) ? "neighbor" : ""} ${focus && !neighbors.has(item.id) ? "dimmed" : ""}`}
                  onMouseEnter={() => setHovered(item.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(item.id)}
                  onBlur={() => setHovered(null)}
                  onClick={() => {
                    setSelectedNode(item.id);
                    setSelectedEdge(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedNode(item.id);
                      setSelectedEdge(null);
                    }
                  }}
                >
                  <title>
                    {item.title} · {item.status}
                  </title>
                  <circle className="node-halo" r="17" />
                  <circle r={focus === item.id ? 8 : 6} />
                  <text
                    y={labels.get(item.id) ?? 28}
                    textAnchor="middle"
                    opacity={labels.has(item.id) ? 1 : 0}
                  >
                    {item.title.length > 32
                      ? item.title.slice(0, 31) + "…"
                      : item.title}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        )}
        <div className="graph-zoom">
          <button aria-label="Zoom out graph" onClick={() => zoom(1 / 1.2)}>
            <Minus size={15} />
          </button>
          <span>{Math.round(view.zoom * 100)}%</span>
          <button aria-label="Zoom in graph" onClick={() => zoom(1.2)}>
            <Plus size={15} />
          </button>
          <button
            aria-label="Reset graph view"
            onClick={() => setView({ x: 0, y: 0, zoom: 1 })}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      {selectedItem && (
        <aside className="graph-context" aria-label="Selected document context">
          <div className="graph-context-heading">
            <strong>{selectedItem.title}</strong>
            <button
              onClick={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              aria-label="Show all graph connections"
            >
              Clear focus
            </button>
            <button onClick={() => onOpen(selectedItem)}>
              Open document ↗
            </button>
          </div>
          <div className="graph-context-links">
            {contextEdges.length ? (
              contextEdges.map((edge) => {
                const incoming = edge.target === selectedItem.id;
                const other = graph.nodes.find(
                  (n) => n.id === (incoming ? edge.source : edge.target),
                )!;
                return (
                  <button
                    key={edgeId(edge)}
                    onClick={() => setSelectedEdge(edgeId(edge))}
                  >
                    <small>
                      {edge.kind === "context"
                        ? incoming
                          ? "Used as context"
                          : "Result using this document"
                        : "Linked document"}
                    </small>
                    <span>{other.title}</span>
                  </button>
                );
              })
            ) : (
              <p>No recorded connections for this document.</p>
            )}
          </div>
        </aside>
      )}
      {inspected && (
        <aside className="graph-evidence" aria-label="Connection evidence">
          <div>
            <strong>
              {inspected.kind === "context"
                ? "Agent context → Result"
                : "Document link"}
            </strong>
            <button
              onClick={() => setSelectedEdge(null)}
              aria-label="Close connection details"
            >
              ×
            </button>
          </div>
          <p>
            {graph.nodes.find((n) => n.id === inspected.source)?.title} →{" "}
            {graph.nodes.find((n) => n.id === inspected.target)?.title}
          </p>
          {inspected.evidence?.map((e) => (
            <button
              className="graph-evidence-run"
              key={e.runId + e.role}
              onClick={() => onRun(e.runId)}
            >
              <span>
                {e.role === "memory" ? "Read memory" : "Input document"}
                {e.dirty ? " · unsaved draft" : ""} · revision{" "}
                {e.revision ?? "unavailable"}
              </span>
              <span>Open task · {e.title}</span>
            </button>
          ))}
          {inspected.kind === "context" && (
            <small>
              Recorded input at execution time. The current document may have
              changed.
            </small>
          )}
        </aside>
      )}
      <footer className="brain-graph-footer">
        <div>
          <span className="graph-edge-legend">→ Agent context</span>
          <span className="graph-wiki-legend">— Wiki link</span>
          <span className="graph-legend active">Active</span>
          <span className="graph-legend proposed">Suggested</span>
          <label>
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
        <p>
          Drag to pan · Scroll to zoom · Select a node to trace context ·
          Connect saved notes with [[document title]]
        </p>
        {graph.unresolved > 0 && (
          <p>
            {graph.unresolved} unresolved or ambiguous links · No connection
            drawn
          </p>
        )}
      </footer>
    </section>
  );
}
