/** Stable model identity; execution state is shown separately. */
export const agentColors: Record<string, string> = {
  nova: "#efb576",
  minimax: "#e98cab", zai: "#cbd285",
  codex: "#bdd5c9", cline: "#d9dfaa", deepseek: "#7ba8f5",
  qwen: "#b09aee", gemini: "#78cfce", mistral: "#efb576",
};
export const agentColor = (mark?: string) => agentColors[mark ?? "codex"] ?? agentColors.codex;
