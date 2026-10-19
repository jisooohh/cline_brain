// Ported from Kuku graph_canvas_pixi.tsx; deterministic cluster layout retained.
// React host supplies BrainItem-derived GraphNode data; renderer-specific mutation removed.
import {
  GRAPH_SETTINGS_DEFAULTS,
  type GraphNode,
  type GraphLink,
} from "./graph_types";
import {
  graphNodeLocalGap,
  type GraphRenderBudget as RenderBudget,
} from "./graph_layout";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UINT32_MAX = 4_294_967_295;
const getGraphSettings = () => GRAPH_SETTINGS_DEFAULTS;
const renderBudget = (): RenderBudget => "normal";
interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
}

interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface DrawOptions {
  links?: boolean;
  clusters?: boolean;
}

interface ClusterLayout {
  index: number;
  nodes: GraphNode[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface ClusterEdge {
  source: ClusterLayout;
  target: ClusterLayout;
  weight: number;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableNoise(value: string): number {
  return stableHash(value) / UINT32_MAX;
}

function budgetNumber(
  budget: RenderBudget,
  values: { normal: number; dense: number; large: number; huge: number },
): number {
  return values[budget];
}

export function buildKukuLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  clusters: string[],
) {
  const byCluster = new Map<number, GraphNode[]>();
  const graphNodeByPath = new Map<string, GraphNode>();
  for (const node of nodes) {
    const list = byCluster.get(node.clusterIndex) ?? [];
    list.push(node);
    byCluster.set(node.clusterIndex, list);
    graphNodeByPath.set(node.filePath, node);
  }

  const clusterEntries = [...byCluster.entries()]
    .filter(([, clusterNodes]) => clusterNodes.length > 0)
    .sort((a, b) => b[1].length - a[1].length || a[0] - b[0]);
  const clusterCount = Math.max(1, clusterEntries.length, clusters.length);
  const settings = getGraphSettings();
  const budget = renderBudget();
  const distanceScale = settings.linkDistance / 180;
  const localGap = graphNodeLocalGap(settings, budget);
  const clusterGap =
    budgetNumber(budget, {
      normal: 88,
      dense: 72,
      large: 58,
      huge: 44,
    }) * Math.max(0.75, Math.min(1.45, distanceScale));
  const clusterLayouts: ClusterLayout[] = clusterEntries.map(
    ([clusterIndex, clusterNodes], i) => {
      const angle = i * GOLDEN_ANGLE - Math.PI / 2;
      const seedRadius =
        Math.sqrt(i) * (clusterGap + Math.sqrt(clusterNodes.length) * localGap);
      return {
        index: clusterIndex,
        nodes: clusterNodes,
        x: Math.cos(angle) * seedRadius,
        y: Math.sin(angle) * seedRadius,
        vx: 0,
        vy: 0,
        radius: Math.max(
          34,
          Math.sqrt(clusterNodes.length) * localGap * 1.22 + 18,
        ),
      };
    },
  );
  const clusterByIndex = new Map(
    clusterLayouts.map((cluster) => [cluster.index, cluster]),
  );
  const edgeWeights = new Map<
    string,
    { source: number; target: number; weight: number }
  >();
  for (const link of links) {
    const source = graphNodeByPath.get(link.source);
    const target = graphNodeByPath.get(link.target);
    if (!source || !target || source.clusterIndex === target.clusterIndex)
      continue;
    const low = Math.min(source.clusterIndex, target.clusterIndex);
    const high = Math.max(source.clusterIndex, target.clusterIndex);
    const key = `${low}:${high}`;
    const edge = edgeWeights.get(key) ?? {
      source: low,
      target: high,
      weight: 0,
    };
    edge.weight += 1;
    edgeWeights.set(key, edge);
  }
  const clusterEdges: ClusterEdge[] = [...edgeWeights.values()]
    .map((edge) => {
      const source = clusterByIndex.get(edge.source);
      const target = clusterByIndex.get(edge.target);
      return source && target ? { source, target, weight: edge.weight } : null;
    })
    .filter((edge): edge is ClusterEdge => edge !== null);

  const simulationSteps = Math.max(
    24,
    Math.min(
      getGraphSettings().warmupTicks,
      budgetNumber(budget, {
        normal: 320,
        dense: 280,
        large: 220,
        huge: 170,
      }),
    ),
  );
  for (let step = 0; step < simulationSteps; step++) {
    const cooling = 1 - step / simulationSteps;
    for (let i = 0; i < clusterLayouts.length; i++) {
      for (let j = i + 1; j < clusterLayouts.length; j++) {
        const a = clusterLayouts[i];
        const b = clusterLayouts[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.001) {
          dx = stableNoise(`${a.index}:${b.index}:x`) - 0.5;
          dy = stableNoise(`${a.index}:${b.index}:y`) - 0.5;
          dist = Math.hypot(dx, dy) || 1;
        }
        const nx = dx / dist;
        const ny = dy / dist;
        const target = a.radius + b.radius + clusterGap;
        const chargeScale = Math.min(
          1.8,
          Math.max(0.35, Math.abs(settings.chargeStrength) / 255),
        );
        const overlapForce = Math.max(0, target - dist) * 0.024 * chargeScale;
        const chargeForce =
          Math.min(3.8, (target * target) / (dist * dist + 1)) *
          0.09 *
          chargeScale;
        const force = (overlapForce + chargeForce) * cooling;
        a.vx -= nx * force;
        a.vy -= ny * force;
        b.vx += nx * force;
        b.vy += ny * force;
      }
    }

    for (const edge of clusterEdges) {
      const dx = edge.target.x - edge.source.x;
      const dy = edge.target.y - edge.source.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const strength = Math.min(7, Math.log2(edge.weight + 1));
      const target =
        edge.source.radius +
        edge.target.radius +
        clusterGap / (1 + strength * 0.26);
      const force =
        (dist - target) *
        0.0032 *
        strength *
        settings.clusterStrength *
        cooling;
      edge.source.vx += nx * force;
      edge.source.vy += ny * force;
      edge.target.vx -= nx * force;
      edge.target.vy -= ny * force;
    }

    for (const cluster of clusterLayouts) {
      cluster.vx += -cluster.x * settings.centerStrength * 0.15 * cooling;
      cluster.vy += -cluster.y * settings.centerStrength * 0.15 * cooling;
      const damping = Math.max(
        0.62,
        Math.min(0.9, 1 - settings.velocityDecay * 0.6),
      );
      cluster.vx *= damping;
      cluster.vy *= damping;
      cluster.x += cluster.vx;
      cluster.y += cluster.vy;
    }
  }

  const layoutNodes: LayoutNode[] = [];
  const nodeByPath = new Map<string, LayoutNode>();

  for (const cluster of clusterLayouts.sort((a, b) => a.index - b.index)) {
    const clusterX =
      clusterCount === 1 ? 0 : cluster.x * settings.clusterRadiusFactor;
    const clusterY =
      clusterCount === 1 ? 0 : cluster.y * settings.clusterRadiusFactor;
    const sorted = [...cluster.nodes].sort((a, b) => b.linkCount - a.linkCount);
    sorted.forEach((node, localIndex) => {
      const angle = localIndex * GOLDEN_ANGLE;
      const radius =
        Math.sqrt(localIndex + 1) *
        localGap *
        (1 + Math.sqrt(sorted.length) * 0.012);
      const degreePull = 1 / (1 + node.linkCount * 0.018);
      const jitter = (stableNoise(node.filePath) - 0.5) * localGap * 0.72;
      const tangentJitter =
        (stableNoise(`${node.filePath}:t`) - 0.5) * localGap * 0.48;
      const layoutNode = {
        ...node,
        x:
          clusterX +
          Math.cos(angle) * (radius * degreePull + jitter) -
          Math.sin(angle) * tangentJitter,
        y:
          clusterY +
          Math.sin(angle) * (radius * degreePull + jitter) +
          Math.cos(angle) * tangentJitter,
        vx: 0,
        vy: 0,
        homeX:
          clusterX +
          Math.cos(angle) * (radius * degreePull + jitter) -
          Math.sin(angle) * tangentJitter,
        homeY:
          clusterY +
          Math.sin(angle) * (radius * degreePull + jitter) +
          Math.cos(angle) * tangentJitter,
      };
      layoutNodes.push(layoutNode);
      nodeByPath.set(node.filePath, layoutNode);
    });
  }

  return {
    nodes: layoutNodes,
    links: links
      .map((link) => {
        const source = nodeByPath.get(link.source);
        const target = nodeByPath.get(link.target);
        return source && target ? { source, target } : null;
      })
      .filter((link): link is LayoutLink => link !== null),
  };
}
