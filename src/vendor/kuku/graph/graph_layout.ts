import { GRAPH_SETTINGS_DEFAULTS, type GraphSettings } from "./graph_types";

export type GraphRenderBudget = "normal" | "dense" | "large" | "huge";
export type GraphSpacingKind = "linked" | "orphan";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function budgetNumber(
  budget: GraphRenderBudget,
  values: { normal: number; dense: number; large: number; huge: number },
): number {
  return values[budget];
}

function spacingMagnitude(settings: GraphSettings, kind: GraphSpacingKind): number {
  return Math.abs(kind === "orphan" ? settings.chargeStrengthOrphan : settings.chargeStrength);
}

function defaultSpacingMagnitude(kind: GraphSpacingKind): number {
  return Math.abs(
    kind === "orphan"
      ? GRAPH_SETTINGS_DEFAULTS.chargeStrengthOrphan
      : GRAPH_SETTINGS_DEFAULTS.chargeStrength,
  );
}

function spacingKindForPair(sourceIsOrphan: boolean, targetIsOrphan: boolean): GraphSpacingKind {
  return sourceIsOrphan || targetIsOrphan ? "orphan" : "linked";
}

export function graphNodeSpacingScale(
  settings: GraphSettings,
  kind: GraphSpacingKind = "linked",
): number {
  return clamp(spacingMagnitude(settings, kind) / defaultSpacingMagnitude(kind), 0.55, 2.1);
}

export function graphNodeLocalGap(settings: GraphSettings, budget: GraphRenderBudget): number {
  const visualNodeMaxSize = settings.nodeMaxSize * settings.nodeSize;
  const minimumGap = visualNodeMaxSize * 2.25 + 3;
  const baseGap = Math.max(
    minimumGap,
    budgetNumber(budget, {
      normal: 15,
      dense: 13,
      large: 10.5,
      huge: 8.6,
    }),
  );

  return Math.max(minimumGap * 0.9, baseGap * graphNodeSpacingScale(settings, "linked"));
}

export function graphNodePairRepulsionRadius(
  settings: GraphSettings,
  budget: GraphRenderBudget,
  sourceIsOrphan: boolean,
  targetIsOrphan: boolean,
): number {
  const kind = spacingKindForPair(sourceIsOrphan, targetIsOrphan);
  const localGap = graphNodeLocalGap(settings, budget);
  const scale = graphNodeSpacingScale(settings, kind);
  const budgetScale = budgetNumber(budget, {
    normal: 1,
    dense: 0.92,
    large: 0.78,
    huge: 0.62,
  });

  return Math.max(
    settings.nodeMaxSize * settings.nodeSize * 2.35 + 5,
    localGap * scale * budgetScale,
  );
}

export function graphNodePairRepulsionStrength(
  settings: GraphSettings,
  sourceIsOrphan: boolean,
  targetIsOrphan: boolean,
): number {
  const kind = spacingKindForPair(sourceIsOrphan, targetIsOrphan);
  return 0.0024 * graphNodeSpacingScale(settings, kind);
}
