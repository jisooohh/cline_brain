import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, parseIssue, scheduleDecision } from "./store.mjs";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "clinebrain-test-"));
  const s = new Store(root);
  t.after(() => {
    s.close();
    rmSync(root, { recursive: true, force: true });
  });
  return s;
}
test("context contains only active memories in the selected project, including Korean", (t) => {
  const s = fixture(t);
  s.saveBrain({
    project: "a",
    title: "저장 정책",
    body: "데이터는 로컬 SQLite 에 저장한다",
    status: "active",
  });
  s.saveBrain({
    project: "a",
    title: "rejected",
    body: "SQLite cloud",
    status: "archived",
  });
  s.saveBrain({
    project: "a",
    title: "draft",
    body: "SQLite cloud",
    status: "proposed",
  });
  s.saveBrain({
    project: "b",
    title: "other project",
    body: "SQLite",
    status: "active",
  });
  const c = s.context("a", "로컬 데이터 SQLite");
  assert.equal(c.length, 1);
  assert.equal(c[0].title, "저장 정책");
});
test("memory writes reject stale revisions and survive restarting", (t) => {
  const s = fixture(t);
  const m = s.saveBrain({ project: "a", title: "decision", body: "First" });
  const updated = s.saveBrain({ ...m, body: "Second" });
  assert.throws(() => s.saveBrain({ ...m, body: "Stale" }), /changed/);
  const another = new Store(s.root);
  assert.equal(another.get("brain", m.id).body, "Second");
  assert.equal(another.get("brain", m.id).revision, updated.revision);
  another.close();
});
test("startup records interrupted runs and uncertain writes", (t) => {
  const s = fixture(t);
  s.put("run", { id: "r", status: "running" });
  s.put("proposal", { id: "p", status: "publishing" });
  const reopened = new Store(s.root);
  assert.equal(reopened.get("run", "r").status, "interrupted");
  assert.equal(reopened.get("proposal", "p").status, "uncertain");
  reopened.close();
});
test("issue URL validates host and path", () => {
  assert.equal(
    parseIssue("https://github.com/cline/cline/issues/123").issue_number,
    123,
  );
  for (const url of [
    "https://evil.test/a/b/issues/1",
    "https://github.com/a/b/pull/1",
    "https://github.com/a/b/issues/1?redirect=x",
  ])
    assert.throws(() => parseIssue(url));
});
test("scheduler uses local timezone and never catches up by silently running", () => {
  const a = {
    enabled: true,
    time: "09:00",
    timezone: "America/Los_Angeles",
    lastDate: null,
  };
  const now = new Date("2026-10-19T16:00:10Z");
  assert.equal(scheduleDecision(a, now, new Date(now - 15000)).action, "run");
  assert.equal(scheduleDecision(a, now, null).action, "missed");
  assert.equal(
    scheduleDecision(a, new Date("2026-10-19T17:00:00Z"), new Date(now - 15000))
      .action,
    "missed",
  );
  assert.equal(
    scheduleDecision(
      { ...a, lastDate: "2026-10-19" },
      now,
      new Date(now - 15000),
    ),
    null,
  );
  assert.equal(scheduleDecision({ ...a, enabled: false }, now, null), null);
});
