import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Snapshot } from "./types";
export const native = isTauri();
export const empty: Snapshot = {
  settings: {
    id: "main",
    project: "ClineBrain",
    providerId: "anthropic",
    modelId: "claude-sonnet-4-6",
    codexPath: "",
    userId: "clinebrain-local",
    connectedAccountId: "",
    authConfigId: "",
  },
  brain: [],
  runs: [],
  proposals: [],
  automations: [],
};
export async function request<T = unknown>(
  method: string,
  params: unknown = {},
): Promise<T> {
  if (!native) {
    if (method === "snapshot") return structuredClone(empty) as T;
    throw new Error(
      "Open the ClineBrain desktop app to use local storage and agent connections. This browser is a visual preview.",
    );
  }
  return invoke<T>("worker_request", { method, params });
}
export const saveCredential = (name: string, value: string) =>
  invoke("credential_save", { name, value });
export const credentials = () =>
  native
    ? invoke<Record<string, boolean>>("credential_status")
    : Promise.resolve({});
export const paths = () =>
  native
    ? invoke<{ nodePath: string; dataDir: string }>("native_paths")
    : Promise.resolve({ nodePath: "", dataDir: "" });
export const saveNode = (path: string) => invoke("native_node_save", { path });
export const events = (
  handler: (payload: {
    type: string;
    data?: Snapshot;
    message?: string;
  }) => void,
) =>
  native
    ? listen<{ type: string; data?: Snapshot; message?: string }>(
        "brain-event",
        (e) => handler(e.payload),
      )
    : Promise.resolve(() => {});
export async function external(url: string) {
  if (!/^https:\/\//i.test(url))
    throw new Error("Only HTTPS links are supported");
  if (native) await openUrl(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
