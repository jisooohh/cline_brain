export interface Source {
  url: string;
  title: string;
  excerpt?: string;
}
export interface BrainItem {
  id: string;
  project: string;
  title: string;
  body: string;
  status: "active" | "proposed" | "archived";
  revision: string;
  sources: Source[];
  runId?: string;
  createdAt: string;
  updatedAt: string;
}
export interface RunEvent {
  runId: string;
  seq: number;
  at: string;
  stage: string;
  agent: string;
  message: string;
  sources?: Source[];
  url?: string;
}
export interface AgentNode {
  task?: string;
  backend?: "codex" | "cline";
  mark?: string;
  id: string;
  parentId: string | null;
  role: string;
  model: string;
  status: string;
  output?: string;
  error?: string;
  sessionId?: string;
}
export interface Run {
  workerBackend?: "codex" | "cline";
  workerModels?: string[];
  mode?: "solo" | "team";
  model?: string;
  workers?: number;
  agents?: AgentNode[];
  id: string;
  project: string;
  title: string;
  issue: { url: string; owner: string; repo: string; issue_number: number };
  template: string;
  status: string;
  stage: string;
  createdAt: string;
  events: RunEvent[];
  context: BrainItem[];
  sources: Source[];
  document?: {
    id?: string;
    revision?: string;
    title: string;
    body: string;
    project: string;
    dirty: boolean;
  };
  instruction?: string;
  proposalId?: string;
  memoryId?: string;
  error?: string;
}
export interface Proposal {
  id: string;
  runId: string;
  issue: Run["issue"];
  body: string;
  status: string;
  revision: string;
  url?: string;
}
export interface Automation {
  id: string;
  template: "issue" | "daily";
  project: string;
  issueUrl: string;
  time: string;
  timezone: string;
  enabled: boolean;
  status: string;
  lastRunId?: string;
  lastDate?: string;
}
export interface Settings {
  id: string;
  project: string;
  providerId: string;
  modelId: string;
  codexPath: string;
  userId: string;
  connectedAccountId: string;
  authConfigId: string;
}
export interface Snapshot {
  settings: Settings;
  brain: BrainItem[];
  runs: Run[];
  proposals: Proposal[];
  automations: Automation[];
}
export type Page = "home" | "agents" | "brain" | "automations" | "connections";
