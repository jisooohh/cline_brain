import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  writeFileSync,
  renameSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
export const id = () => randomUUID();
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
export const revision = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex")
    .slice(0, 20);
const memoryIdPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
export function requireText(value, name, max = 30000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`Invalid ${name}`);
  return value.trim();
}
export function parseIssue(url) {
  const m =
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\/?$/.exec(url);
  if (
    !m ||
    [m[1], m[2]].some((segment) => segment === "." || segment === "..") ||
    !Number.isSafeInteger(Number(m[3])) ||
    Number(m[3]) < 1
  )
    throw new Error(
      "Enter a GitHub issue URL: https://github.com/owner/repo/issues/123",
    );
  return {
    owner: m[1],
    repo: m[2],
    issue_number: Number(m[3]),
    url: url.replace(/\/$/, ""),
  };
}
export class Store {
  constructor(root) {
    this.root = root;
    this.brainDir = join(root, "brain");
    mkdirSync(this.brainDir, { recursive: true });
    this.db = new DatabaseSync(join(root, "brain.sqlite"));
    this.db.exec(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, json TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE VIRTUAL TABLE IF NOT EXISTS brain_search USING fts5(id UNINDEXED,title,body,tokenize='unicode61');`,
    );
    // Markdown is authoritative; never retain a deleted/corrupt source in active context.
    this.db.exec(
      "DELETE FROM records WHERE kind='brain'; DELETE FROM brain_search;",
    );
    // Recover an interrupted file/index update on startup.
    for (const file of readdirSync(this.brainDir).filter((f) =>
      f.endsWith(".md"),
    )) {
      try {
        const raw = readFileSync(join(this.brainDir, file), "utf8");
        const end = raw.indexOf("\n-->\n");
        if (!raw.startsWith("<!-- ") || end < 0) continue;
        const item = JSON.parse(raw.slice(5, end));
        if (!memoryIdPattern.test(item.id) || file !== `${item.id}.md`)
          continue;
        item.body = raw.slice(end + 5);
        requireText(item.project, "project", 100);
        requireText(item.title, "title", 200);
        requireText(item.body, "memory");
        const { revision: previousRevision, ...content } = item;
        item.revision = revision(content);
        this.put("brain", item);
        this.index(item);
      } catch {
        /* preserve unreadable originals */
      }
    }
    for (const run of this.all("run"))
      if (["running", "queued"].includes(run.status)) {
        run.status = "interrupted";
        for (const node of run.agents ?? []) if (["running", "queued", "waiting"].includes(node.status)) { node.status = "interrupted"; node.error = "App closed before this agent finished."; }
        run.error = "App closed before this run finished.";
        this.put("run", run);
      }
    for (const p of this.all("proposal"))
      if (p.status === "publishing") {
        p.status = "uncertain";
        this.put("proposal", p);
      }
  }
  all(kind) {
    return this.db
      .prepare("SELECT json FROM records WHERE kind=? ORDER BY rowid DESC")
      .all(kind)
      .map((r) => JSON.parse(r.json));
  }
  get(kind, key) {
    const r = this.db
      .prepare("SELECT json FROM records WHERE kind=? AND id=?")
      .get(kind, key);
    return r ? JSON.parse(r.json) : null;
  }
  put(kind, value) {
    this.db
      .prepare(
        "INSERT INTO records(kind,id,json) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json",
      )
      .run(kind, value.id, JSON.stringify(value));
    return value;
  }
  settings() {
    return (
      this.get("settings", "main") ?? {
        id: "main",
        project: "ClineBrain",
        providerId: "anthropic",
        modelId: "claude-sonnet-4-6",
        codexPath: "",
        userId: "clinebrain-local",
        connectedAccountId: "",
        authConfigId: "",
      }
    );
  }
  index(item) {
    this.db.prepare("DELETE FROM brain_search WHERE id=?").run(item.id);
    this.db
      .prepare("INSERT INTO brain_search(id,title,body) VALUES(?,?,?)")
      .run(item.id, item.title, item.body);
  }
  saveBrain(input) {
    if (input.id && !memoryIdPattern.test(input.id))
      throw new Error("Invalid memory ID");
    const old = input.id ? this.get("brain", input.id) : null;
    if (input.id && !old) throw new Error("Memory not found");
    if (old && input.revision !== old.revision)
      throw new Error("Memory changed. Reload before saving.");
    const status = input.status ?? "active";
    if (!["active", "proposed", "archived"].includes(status))
      throw new Error("Invalid memory status");
    const item = {
      id: old?.id ?? id(),
      project: requireText(input.project, "project", 100),
      title: requireText(input.title, "title", 200),
      body: requireText(input.body, "memory"),
      status,
      sources: input.sources ?? old?.sources ?? [],
      runId: input.runId ?? old?.runId ?? null,
      createdAt: old?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    item.revision = revision(item);
    const { body, ...meta } = item;
    const dest = join(this.brainDir, `${item.id}.md`);
    writeFileSync(`${dest}.tmp`, `<!-- ${JSON.stringify(meta)}\n-->\n${body}`, {
      mode: 0o600,
    });
    renameSync(`${dest}.tmp`, dest);
    this.put("brain", item);
    this.index(item);
    return item;
  }
  context(project, query) {
    const active = this.all("brain").filter(
      (m) => m.project === project && m.status === "active",
    );
    const terms = (query.normalize("NFKC").match(/[\p{L}\p{N}_]+/gu) ?? [])
      .filter((t) => t.length > 1)
      .slice(0, 30);
    let ranks = [];
    if (terms.length) {
      const match = terms
        .map((t) => `"${t.replaceAll('"', '""')}"`)
        .join(" OR ");
      ranks = this.db
        .prepare(
          "SELECT id FROM brain_search WHERE brain_search MATCH ? ORDER BY rank LIMIT 30",
        )
        .all(match)
        .map((r) => r.id);
    }
    const score = (m) =>
      ranks.includes(m.id)
        ? 100 - ranks.indexOf(m.id)
        : terms.reduce(
            (n, t) =>
              n +
              (m.title + " " + m.body)
                .toLocaleLowerCase()
                .includes(t.toLocaleLowerCase()),
            0,
          );
    let budget = 14000;
    return active
      .sort((a, b) => score(b) - score(a))
      .slice(0, 8)
      .flatMap((m) => {
        const body = m.body.slice(0, Math.min(4000, budget));
        budget -= body.length;
        return body ? [{ ...m, body }] : [];
      });
  }
  snapshot() {
    return {
      settings: this.settings(),
      brain: this.all("brain"),
      runs: this.all("run").slice(0, 40),
      proposals: this.all("proposal"),
      automations: this.all("automation"),
    };
  }
  close() {
    this.db.close();
  }
}
export function localDateTime(date, timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
export function scheduleDecision(a, now, lastTick) {
  if (!a.enabled) return null;
  const current = localDateTime(now, a.timezone);
  if (current.time < a.time || a.lastDate === current.date) return null;
  const late =
    Number(current.time.slice(0, 2)) * 60 +
    Number(current.time.slice(3)) -
    (Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3)));
  return {
    date: current.date,
    action: !lastTick || now - lastTick > 90000 || late > 1 ? "missed" : "run",
  };
}
