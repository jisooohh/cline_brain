import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, revision } from "./store.mjs";
import { Engine } from "./engine.mjs";
function fixture(t, github) {
  const root = mkdtempSync(join(tmpdir(), "clinebrain-engine-"));
  const store = new Store(root);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const engine = new Engine(store, () => {}, { github });
  const p = {
    id: "p",
    runId: "r",
    issue: {
      owner: "owner",
      repo: "repo",
      issue_number: 1,
      url: "https://github.com/owner/repo/issues/1",
    },
    body: "Reviewed response",
    status: "pending",
  };
  p.revision = revision({ issue: p.issue, body: p.body });
  store.put("proposal", p);
  return { store, engine, p };
}
test("publication is verified and duplicate clicks cannot create another comment", async (t) => {
  let writes = 0;
  let posted;
  const { engine, p } = fixture(t, async (path, method, body) => {
    if (method === "POST") {
      writes++;
      posted = {
        id: 5,
        body: body.body,
        html_url: "https://github.com/owner/repo/issues/1#issuecomment-5",
      };
      await new Promise((r) => setTimeout(r, 10));
      return posted;
    }
    return posted;
  });
  const args = { id: p.id, revision: p.revision };
  const results = await Promise.allSettled([
    engine.publish(args),
    engine.publish(args),
  ]);
  assert.equal(writes, 1);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await engine.publish(args)).status, "published");
  assert.equal(writes, 1);
});
test("edited proposal invalidates previous approval", async (t) => {
  const { engine, p } = fixture(t, () => {
    throw new Error("must not call GitHub");
  });
  engine.editProposal({ id: p.id, revision: p.revision, body: "Changed" });
  await assert.rejects(
    engine.publish({ id: p.id, revision: p.revision }),
    /changed/,
  );
});
test("ambiguous network failure reconciles by marker without another POST", async (t) => {
  let writes = 0;
  let posted;
  const { engine, p } = fixture(t, async (path, method, body) => {
    if (method === "POST") {
      writes++;
      posted = {
        id: 5,
        body: body.body,
        html_url: "https://github.com/owner/repo/issues/1#issuecomment-5",
      };
      throw new Error("connection lost after server accepted write");
    }
    return [posted];
  });
  const result = await engine.publish({ id: p.id, revision: p.revision });
  assert.equal(result.status, "published");
  assert.equal(writes, 1);
});
test("unconfirmed publication stays uncertain and check never resends", async (t) => {
  let writes = 0;
  const { engine, p, store } = fixture(t, async (path, method) => {
    if (method === "POST") {
      writes++;
      throw new Error("network down");
    }
    return [];
  });
  await assert.rejects(
    engine.publish({ id: p.id, revision: p.revision }),
    /unconfirmed/,
  );
  assert.equal(store.get("proposal", p.id).status, "uncertain");
  await assert.rejects(
    engine.publish({ id: p.id, revision: p.revision }),
    /unconfirmed/,
  );
  assert.equal(writes, 1);
});
test("missing credentials produce a visible failed run, not success", async (t) => {
  const { engine, store } = fixture(t, () => {});
  const run = engine.start({
    project: "a",
    issueUrl: "https://github.com/a/b/issues/1",
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.get("run", run.id).status, "failed");
  assert.match(store.get("run", run.id).error, /Connections/);
  assert.equal(engine.active, null);
});
