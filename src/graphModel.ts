import { buildKukuLayout } from "./vendor/kuku/graph/layout";
import type { BrainItem, Run } from "./types";

export const linkTitle = (value: string) =>
  value
    .split("#")[0]
    .trim()
    .replace(/\.md$/i, "")
    .normalize("NFC")
    .toLocaleLowerCase();

export interface GraphEdge {
  source: string;
  target: string;
  kind?: "context";
  evidence?: {
    runId: string;
    title: string;
    role: "memory" | "document";
    revision?: string;
    dirty?: boolean;
  }[];
}
export function buildBrainGraph(
  items: BrainItem[],
  project: string,
  runs: Run[] = [],
) {
  const nodes = items
    .filter((item) => item.project === project)
    .sort((a, b) => a.id.localeCompare(b.id));
  const titles = new Map<string, BrainItem[]>();
  for (const item of nodes) {
    const key = linkTitle(item.title);
    titles.set(key, [...(titles.get(key) ?? []), item]);
  }
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  let unresolved = 0;
  for (const item of nodes) {
    // Literal examples in code blocks are not document relationships.
    const prose = item.body
      .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
      .replace(/`+[^`]*`+/g, "");
    for (const match of prose.matchAll(
      /(?<!\\)\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g,
    )) {
      const matches = titles.get(linkTitle(match[1]));
      if (matches?.length !== 1) {
        unresolved++;
        continue;
      }
      const target = matches[0].id;
      if (target === item.id) continue;
      const key = [item.id, target].sort().join(":");
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ source: item.id, target });
      }
    }
  }
  // Provenance is historical: use captured inputs, never today's active-memory selection.
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const contextEdges = new Map<string, GraphEdge>();
  for (const run of runs) {
    if (run.project !== project || !run.memoryId) continue;
    const result = byId.get(run.memoryId);
    if (!result || result.runId !== run.id) continue;
    const inputs = [
      ...(run.context ?? [])
        .filter((m) => m.project === project)
        .map((m) => ({
          id: m.id,
          revision: m.revision,
          role: "memory" as const,
          dirty: false,
        })),
      ...(run.document?.id && run.document.project === project
        ? [
            {
              id: run.document.id,
              revision: run.document.revision,
              role: "document" as const,
              dirty: run.document.dirty,
            },
          ]
        : []),
    ];
    for (const input of inputs) {
      if (!byId.has(input.id) || input.id === result.id) continue;
      const key = JSON.stringify([input.id, result.id]);
      const edge = contextEdges.get(key) ?? {
        source: input.id,
        target: result.id,
        kind: "context",
        evidence: [],
      };
      if (
        !edge.evidence!.some((e) => e.runId === run.id && e.role === input.role)
      )
        edge.evidence!.push({
          runId: run.id,
          title: run.title,
          role: input.role,
          revision: input.revision,
          dirty: input.dirty,
        });
      contextEdges.set(key, edge);
    }
  }
  edges.push(...contextEdges.values());
  return { nodes, edges, unresolved };
}

export function layoutBrainGraph(graph: ReturnType<typeof buildBrainGraph>) {
  const degrees = new Map<string, number>();
  for (const edge of graph.edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  const original = new Map(graph.nodes.map((item) => [item.id, item]));
  const nodes = graph.nodes.map((item) => ({
    id: item.id,
    filePath: item.id,
    name: item.title,
    folder: item.project,
    clusterIndex: 0,
    linkCount: degrees.get(item.id) ?? 0,
    isOrphan: !degrees.has(item.id),
  }));
  return buildKukuLayout(nodes, graph.edges, ["project"]).nodes.map((node) => ({
    item: original.get(node.id)!,
    x: node.x,
    y: node.y,
  }));
}

// Fit Kuku's stable layout to the canvas rather than a fixed square viewport.
export function spreadGraphPoints(
  points: ReturnType<typeof layoutBrainGraph>,
  width: number,
  height: number,
) {
  if (!points.length) return [];
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const usableX = Math.max(80, width - 220),
    usableY = Math.max(80, height - 160);
  return points.map((p) => ({
    ...p,
    x: maxX === minX ? 0 : ((p.x - minX) / (maxX - minX) - 0.5) * usableX,
    y: maxY === minY ? 0 : ((p.y - minY) / (maxY - minY) - 0.5) * usableY,
  }));
}
export function graphNeighborhood(edges: GraphEdge[], selected: string | null) {
  const ids = new Set<string>(selected ? [selected] : []);
  if (selected)
    for (const e of edges)
      if (e.source === selected || e.target === selected) {
        ids.add(e.source);
        ids.add(e.target);
      }
  return ids;
}
