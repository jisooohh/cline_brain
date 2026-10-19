import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { TileRenderer } from "./vendor/exawatt/tile-renderer";
import { HARNESS_MARK_PATHS } from "./vendor/exawatt/harness-icons";
import { harnessMarkTone } from "./vendor/exawatt/harness-mark-tones";
import { hexSpiral } from "./vendor/exawatt/hex";
import { DEFAULT_MOTION } from "./vendor/exawatt/crust-motion";
import type { TileFrame, TileInstance } from "./vendor/exawatt/tile-contract";
import type { SpatialThemeSnapshot } from "./vendor/exawatt/types";
import { agentColor } from "./agentAppearance";
import type { Run } from "./types";
const theme: SpatialThemeSnapshot = {
  canvas: "#1d1d1d",
  zone: "#42443f",
  grid: "#303030",
  gridMajor: "#424a56",
  label: "#e9e8e3",
  unitMuted: "#8c939e",
  selection: "#d6efb8",
  status: {
    active: "#b6c5b0",
    "needs-you": "#EAB995",
    result: "#9BF396",
    off: "#c5d1dd",
    fault: "#ed7d7d",
  },
};
const marks = { paths: HARNESS_MARK_PATHS, tone: harnessMarkTone };

class BoardBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="board-fallback">
        3D view unavailable on this device.
        <br />
        Agent status remains available.
      </div>
    ) : (
      this.props.children
    );
  }
}
function Camera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 5.7, 6.4);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}
function Scene({
  runs,
  onSelect,
  selectedAgent,
}: {
  runs: Run[];
  onSelect: (runId: string, agentId?: string) => void;
  selectedAgent: string | null;
}) {
  const selected = selectedAgent;
  const frame = useRef<TileFrame>({ focusId: null, selection: new Set() });
  const tiles = useMemo(() => {
    const nodes = runs
      .flatMap((run) =>
        run.agents
          ? run.agents.map((n) => ({
              id: n.id,
              runId: run.id,
              mark: n.mark ?? "codex",
              status: n.status,
            }))
          : [
              {
                status: run.status,
                id: run.id,
                runId: run.id,
                mark: run.stage === "draft" ? "codex" : "cline",
              },
            ],
      )
      .slice(0, 7);
    return hexSpiral({ q: 0, r: 0 }, 1).map(
      ({ axial, ring }, i) =>
        ({
          id: String(i),
          x: Math.sqrt(3) * (axial.q + axial.r / 2),
          y: 1.5 * axial.r,
          ring,
          agentId: nodes[i]?.id,
          mark: nodes[i]?.mark,
          color: nodes[i] ? (nodes[i].status === "completed" ? "#858989" : agentColor(nodes[i].mark)) : undefined,
          status: !nodes[i]
            ? undefined
            : nodes[i].status === "running"
              ? "active"
              : nodes[i].status === "completed"
                ? "result"
                : nodes[i].status === "failed"
                  ? "fault"
                  : "off",
          phase: i,
          runId: nodes[i]?.runId,
        }) as TileInstance & { runId?: string },
    );
  }, [runs]);
  frame.current = {
    focusId: selected,
    selection: new Set(selected ? [selected] : []),
  };
  return (
    <>
      <Camera />
      <color attach="background" args={[theme.canvas]} />
      <fog attach="fog" args={[theme.canvas, 40, 100]} />
      <ambientLight intensity={0.7} />
      <TileRenderer
        tiles={tiles}
        surface="sphere"
        theme={theme}
        marks={marks}
        readFrame={() => frame.current}
        material="matte"
        mark="relief"
        shape="rounded"
        motion={
          runs.length > 0
            ? { ...DEFAULT_MOTION, wander: false, breathe: true, lift: "bob" }
            : { ...DEFAULT_MOTION, wander: false, lift: "still" }
        }
        signal="paint"
        light="studio"
        reducedMotion={
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        }
        sound={false}
        onSelect={(id) => {
          const tile = tiles.find((t) => t.agentId === id);
          if (tile?.runId) onSelect(tile.runId, id ?? undefined);
        }}
      />
    </>
  );
}
export default function Board({
  runs,
  onSelect,
  selectedAgent,
}: {
  runs: Run[];
  onSelect: (runId: string, agentId?: string) => void;
  selectedAgent: string | null;
}) {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  return (
    <BoardBoundary>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 36, near: 0.5, far: 200 }}
        frameloop={visible ? "always" : "never"}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <Scene runs={runs} onSelect={onSelect} selectedAgent={selectedAgent} />
      </Canvas>
    </BoardBoundary>
  );
}
