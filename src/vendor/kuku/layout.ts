import { useEffect, useState } from "react";
const key = "clinebrain-layout-v1";
const defaults = {
  leftPanelWidth: 240,
  bottomPanelHeight: 220,
  bottomPanelOpen: false,
  rightPanelWidth: 380,
  rightPanelOpen: true,
  inspectorTab: "agents",
  boardExpanded: false,
  terminalExpanded: false,
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export function usePanelLayout() {
  const [layout, set] = useState(() => {
    let saved: Record<string, unknown> = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      /* defaults */
    }
    const result = { ...defaults };
    for (const k of Object.keys(defaults) as (keyof typeof defaults)[]) {
      if (
        typeof saved[k] === typeof defaults[k] &&
        (typeof saved[k] !== "number" || Number.isFinite(saved[k]))
      )
        Object.assign(result, { [k]: saved[k] });
    }
    result.rightPanelWidth = clamp(result.rightPanelWidth, 320, 560);
    result.leftPanelWidth = clamp(result.leftPanelWidth, 200, 360);
    result.inspectorTab =
      result.inspectorTab === "document" ? "document" : "agents";
    return result;
  });
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const resize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(layout));
  }, [layout]);
  const patch = (value: Partial<typeof defaults>) =>
    set((s) => ({ ...s, ...value }));
  const overlay =
    size.width - layout.leftPanelWidth - layout.rightPanelWidth < 568;
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    setOverlayOpen(false);
  }, [overlay]);
  return {
    ...layout,
    overlay,
    rightVisible: overlay ? overlayOpen : layout.rightPanelOpen,
    bottomPanelHeight: layout.terminalExpanded
      ? Math.max(100, size.height - 130)
      : clamp(layout.bottomPanelHeight, 100, size.height * 0.45),
    setLeftPanelWidth: (n: number) =>
      patch({
        leftPanelWidth: clamp(n, 200, Math.min(360, size.width * 0.35)),
      }),
    setRightPanelWidth: (n: number) =>
      patch({ rightPanelWidth: clamp(n, 320, 560) }),
    setBottomPanelHeight: (n: number) =>
      patch({
        bottomPanelHeight: clamp(n, 100, size.height * 0.45),
        terminalExpanded: false,
      }),
    openAgents: () => {
      patch({ rightPanelOpen: true, inspectorTab: "agents" });
      setOverlayOpen(true);
    },
    toggleRightPanel: () =>
      overlay
        ? setOverlayOpen((s) => !s)
        : set((s) => ({ ...s, rightPanelOpen: !s.rightPanelOpen })),
    setInspectorTab: (tab: string) => patch({ inspectorTab: tab }),
    toggleBoard: () => set((s) => ({ ...s, boardExpanded: !s.boardExpanded })),
    toggleTerminalExpanded: () =>
      set((s) => ({ ...s, terminalExpanded: !s.terminalExpanded })),
    toggleBottomPanel: () =>
      set((s) => ({ ...s, bottomPanelOpen: !s.bottomPanelOpen })),
  };
}
