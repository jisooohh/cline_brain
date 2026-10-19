import { setTimeout as sleep } from "node:timers/promises";
import { Agent } from "@cline/agents";
export class ClineAdapter {
  constructor(apiKey, model, createAgent = (config) => new Agent(config), wait = (ms, signal) => sleep(ms, undefined, { signal })) {
    this.apiKey = apiKey;
    this.model = model;
    this.createAgent = createAgent;
    this.wait = wait;
  }
  cancel() {
    this.agent?.abort("Cancelled");
  }
  async start(prompt, onEvent, signal) {
    for (let attempt = 0; attempt < 3; attempt++) {
      signal?.throwIfAborted();
      try {
        return await this.startOnce(prompt, onEvent, signal);
      } catch (error) {
        signal?.throwIfAborted();
        const limited = /\b429\b|rate.limit/i.test(String(error?.message));
        if (!limited) throw error;
        if (attempt === 2) throw new Error(`${this.model} is temporarily rate-limited by its provider (429). Two retries did not succeed. Try again later or choose another worker model.`);
        const delay = attempt === 0 ? 2000 : 5000;
        onEvent({ type: "agent.retry", message: `Provider rate limit (429). Retrying in ${delay / 1000}s (${attempt + 1}/2).` });
        await this.wait(delay, signal);
      }
    }
  }
  async startOnce(prompt, onEvent, signal) {
    signal?.throwIfAborted();
    if (!this.apiKey)
      throw new Error("Save your Cline API key in Connections first.");
    this.agent = this.createAgent({
      providerId: "cline",
      modelId: this.model,
      apiKey: this.apiKey,
      tools: [],
      maxIterations: 1,
      systemPrompt:
        "You are a focused document subagent. Use only supplied context. Return concise Markdown in the user’s language, at most 500 words. No tool use, external actions, or invented sources.",
    });
    const abort = () => this.cancel();
    signal?.addEventListener("abort", abort, { once: true });
    let timer;
    try {
      const result = await Promise.race([
        this.agent.run(prompt),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            this.cancel();
            reject(new Error("Cline subagent exceeded 3 minutes"));
          }, 180000);
        }),
      ]);
      signal?.throwIfAborted();
      if (result.status !== "completed")
        throw new Error(result.error?.message ?? `Cline ${result.status}`);
      if (!result.outputText?.trim())
        throw new Error("Cline returned no result");
      onEvent({ type: "thread.started", thread_id: result.runId });
      return result.outputText;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      this.agent = undefined;
    }
  }
}
