// ── Default Theme Plugin ──
//
// Provides the built-in Kuku dark and light themes.
// Color values are extracted from the base CSS tokens in index.css
// so this plugin can re-apply them at runtime via the theme registry.
//
// This plugin has no commands, no editor contributions, and no views —
// it only contributes a ThemePack with two variants.

// ── Plugin Definition ──

const themeDefaultPlugin = {
  id: "theme-default",
  name: "Default Theme",
  version: "0.1.0",
  description: "Built-in Kuku dark and light themes",

  themes: [
    {
      id: "kuku-default",
      name: "Kuku Default",
      author: "Kuku",
      variants: [
        // ── Dark ──
        {
          name: "Kuku Dark",
          appearance: "dark",
          colors: {
            bgPrimary: "#1a1a1a",
            bgSecondary: "#222222",
            bgTertiary: "#2a2a2a",
            bgElevated: "#2e2e2e",
            textPrimary: "#d4d4d4",
            textSecondary: "#969696",
            textMuted: "#5a5a5a",
            accent: "#d4d4d4",
            accentDim: "rgba(212, 212, 212, 0.12)",
            listActive: "rgba(212, 212, 212, 0.15)",
            listInactive: "rgba(212, 212, 212, 0.08)",
            border: "#2a2a2a",
          },
          extended: {
            ghostHover: "rgba(255, 255, 255, 0.06)",
            ghostSelected: "rgba(255, 255, 255, 0.1)",
            error: "#e55561",
            warning: "#e5a644",
            success: "#6bc46d",
            info: "#8a8a8a",
          },
          syntax: {
            default: "#abb2bf",
            comment: "#5c6370",
            keyword: "#c678dd",
            string: "#98c379",
            function: "#61aeee",
            number: "#d19a66",
            operator: "#abb2bf",
            punctuation: "#abb2bf",
            type: "#d19a66",
            variable: "#d19a66",
            property: "#d19a66",
            namespace: "#e06c75",
            tag: "#e06c75",
            attr: "#d19a66",
            "attr-name": "#d19a66",
            meta: "#61aeee",
            builtin: "#e6c07b",
            constant: "#56b6c2",
            literal: "#56b6c2",
            regexp: "#98c379",
            title: "#61aeee",
            selector: "#e06c75",
            deletion: "#e06c75",
            addition: "#98c379",
          },
        },

        // ── Light ──
        {
          name: "Kuku Light",
          appearance: "light",
          colors: {
            bgPrimary: "#ffffff",
            bgSecondary: "#f5f5f5",
            bgTertiary: "#ebebeb",
            bgElevated: "#e0e0e0",
            textPrimary: "#1a1a1a",
            textSecondary: "#666666",
            textMuted: "#999999",
            accent: "#1a1a1a",
            accentDim: "rgba(0, 0, 0, 0.06)",
            listActive: "rgba(0, 0, 0, 0.1)",
            listInactive: "rgba(0, 0, 0, 0.05)",
            border: "#e0e0e0",
          },
          extended: {
            ghostHover: "rgba(0, 0, 0, 0.05)",
            ghostSelected: "rgba(0, 0, 0, 0.1)",
            error: "#dc3545",
            warning: "#d4940a",
            success: "#28a745",
            info: "#525252",
          },
          syntax: {
            default: "#383a42",
            comment: "#a0a1a7",
            keyword: "#a626a4",
            string: "#50a14f",
            function: "#4078f2",
            number: "#986801",
            operator: "#383a42",
            punctuation: "#383a42",
            type: "#986801",
            variable: "#986801",
            property: "#986801",
            namespace: "#e45649",
            tag: "#e45649",
            attr: "#986801",
            "attr-name": "#986801",
            meta: "#4078f2",
            builtin: "#c18401",
            constant: "#0184bb",
            literal: "#0184bb",
            regexp: "#50a14f",
            title: "#4078f2",
            selector: "#e45649",
            deletion: "#e45649",
            addition: "#50a14f",
          },
        },
      ],
    },
  ],
};

// ── Exports ──

export { themeDefaultPlugin };
