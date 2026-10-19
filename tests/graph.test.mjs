import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const result = await build({
  entryPoints: ["src/graphModel.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { buildBrainGraph, layoutBrainGraph } = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
const item = (id, title, body = "", project = "A") => ({
  id,
  title,
  body,
  project,
  status: "active",
});
test("wiki aliases, headings, extension and reciprocal links resolve once", () => {
  const g = buildBrainGraph(
    [
      item("1", "First", "[[Second.md#Heading|Alias]] [[Second]]"),
      item("2", "Second", "[[First]]"),
    ],
    "A",
  );
  assert.equal(g.edges.length, 1);
  assert.equal(g.unresolved, 0);
});
test("project isolation, unresolved and ambiguous titles never invent edges", () => {
  const g = buildBrainGraph(
    [
      item("1", "First", "[[Other]] [[Same]]"),
      item("2", "Other", "", "B"),
      item("3", "Same"),
      item("4", "Same"),
    ],
    "A",
  );
  assert.equal(g.nodes.length, 3);
  assert.equal(g.edges.length, 0);
  assert.equal(g.unresolved, 2);
});
test("code examples and escaped links are excluded, Korean titles resolve", () => {
  const g = buildBrainGraph(
    [
      item(
        "1",
        "First",
        "```md\n[[Fake]]\n```\n`[[Fake]]` \\[[Fake]] [[기억]]",
      ),
      item("2", "기억"),
      item("3", "Fake"),
    ],
    "A",
  );
  assert.deepEqual(g.edges, [{ source: "1", target: "2" }]);
});
test("isolated nodes remain visible with deterministic finite positions", () => {
  const g = buildBrainGraph([item("1", "Alone"), item("2", "Other")], "A");
  const positions = layoutBrainGraph(g);
  assert.equal(positions.length, 2);
  assert.deepEqual(positions, layoutBrainGraph(g));
  assert.ok(
    positions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  );
});
test("saved result links to captured memories and document, retaining exact revision and draft provenance", () => {
  const memory = {
    ...item("1", "Memory"),
    status: "archived",
    revision: "new",
  };
  const doc = item("2", "Document");
  const result = { ...item("3", "Result"), runId: "r" };
  const run = {
    id: "r",
    title: "Research",
    project: "A",
    memoryId: "3",
    context: [{ ...memory, status: "active", revision: "old" }],
    document: { id: "2", project: "A", revision: "v1", dirty: true },
  };
  const graph = buildBrainGraph([memory, doc, result], "A", [run]);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.edges[0].kind, "context");
  assert.equal(graph.edges[0].evidence[0].revision, "old");
  assert.equal(graph.edges[1].evidence[0].dirty, true);
  assert.equal(graph.edges[1].target, "3");
});
test("provenance rejects unrelated projects, missing results and mismatched run ownership", () => {
  const memory = item("1", "Memory");
  const result = { ...item("3", "Result"), runId: "r" };
  const base = {
    id: "r",
    title: "Task",
    project: "A",
    memoryId: "3",
    context: [memory],
  };
  assert.equal(
    buildBrainGraph([memory, result], "A", [
      { ...base, project: "B" },
      { ...base, id: "wrong" },
      { ...base, memoryId: undefined },
    ]).edges.length,
    0,
  );
  assert.equal(buildBrainGraph([result], "A", [base]).edges.length, 0);
});
test("memory and document roles share an edge without losing evidence; wiki links remain independent", () => {
  const a = item("1", "First", "[[Result]]");
  const b = { ...item("2", "Result"), runId: "r" };
  const run = {
    id: "r",
    project: "A",
    title: "Task",
    memoryId: "2",
    context: [a, a],
    document: { id: "1", project: "A", dirty: false },
  };
  const g = buildBrainGraph([a, b], "A", [run]);
  assert.equal(g.edges.length, 2);
  assert.equal(g.edges[1].evidence.length, 2);
});
test('graph spreads across wide canvas and focus includes only direct neighbors',async()=>{
 const {spreadGraphPoints,graphNeighborhood}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const raw=[{item:item('a','A'),x:0,y:0},{item:item('b','B'),x:10,y:10}];
 const wide=spreadGraphPoints(raw,1000,600);assert.equal(wide[1].x-wide[0].x,780);assert.equal(wide[1].y-wide[0].y,440);
 assert.deepEqual([...graphNeighborhood([{source:'a',target:'b'},{source:'b',target:'c'}],'a')],['a','b']);
 assert.ok(spreadGraphPoints([raw[0]],300,200).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
