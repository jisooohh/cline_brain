import { createInterface } from "node:readline";
import { Store, requireText } from "./store.mjs";
import { Engine } from "./engine.mjs";
import { discoverCodex } from "./adapters.mjs";
// stdout is reserved for the native bridge. SDK diagnostics go to stderr.
console.log = (...args) => console.error(...args);
const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
const store = new Store(process.argv[2]);
const engine = new Engine(store, send);
const settings = store.settings();
if (!settings.codexPath) {
  settings.codexPath = discoverCodex();
  store.put("settings", settings);
}
async function dispatch(method, p) {
  switch (method) {
    case "init":
      engine.secrets = p.secrets ?? {};
      return store.snapshot();
    case "snapshot":
      return store.snapshot();
    case "settings.save": {
      const old = store.settings();
      for (const k of [
        "project",
        "providerId",
        "modelId",
        "codexPath",
        "userId",
        "connectedAccountId",
        "authConfigId",
      ])
        if (typeof p[k] === "string") old[k] = p[k].trim();
      requireText(old.project, "project", 100);
      requireText(old.userId, "user ID", 100);
      store.put("settings", old);
      engine.changed();
      return old;
    }
    case "secrets.update":
      engine.secrets = { ...engine.secrets, ...p };
      return true;
    case "connections.probe":
      return engine.probe();
    case "connections.link":
      return engine.link();
    case "brain.save": {
      const m = store.saveBrain(p);
      engine.changed();
      return m;
    }
    case "document.start":
      return engine.startDocument(p);
    case "run.start":
      return engine.start(p);
    case "run.cancel":
      return engine.cancel(p.id, p.agentId);
    case "proposal.edit":
      return engine.editProposal(p);
    case "proposal.publish":
      return engine.publish(p);
    case "automation.save":
      return engine.saveAutomation(p);
    default:
      throw new Error("Unknown worker command");
  }
}
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let r;
  try {
    r = JSON.parse(line);
  } catch {
    return;
  }
  Promise.resolve()
    .then(() => dispatch(r.method, r.params ?? {}))
    .then((result) => send({ id: r.id, result }))
    .catch((error) =>
      send({ id: r.id, error: engine.sanitize(error.message) }),
    );
});
const timer = setInterval(() => {
  try {
    engine.tick();
  } catch (e) {
    console.error(engine.sanitize(e.message));
  }
}, 15000);
timer.unref();
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  engine.cancelAll();
  // Leave time for the adapter to terminate its entire child process group.
  setTimeout(() => {
    store.close();
    process.exit(0);
  }, 1800);
}
rl.on("close", shutdown);
process.on("SIGTERM", shutdown);
send({ type: "ready" });
