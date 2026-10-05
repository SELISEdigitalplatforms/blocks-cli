/**
 * Direct TypeScript port of blocks-logic client layout-utils.ts getLayoutedElements.
 * Constants and longest-path layering kept identical so CLI layouts match the portal.
 */

const NODE_WIDTH = 200;
const NODE_HEIGHT = 150;
const HORIZONTAL_SPACING = 70;
const VERTICAL_SPACING = 50;

export type LayoutNode = { id: string; position: { x: number; y: number } };
export type LayoutEdge = { source: string; target: string };

export function getLayoutedElements(
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const layerMap: Record<string, number> = {};
  for (const node of nodes) layerMap[node.id] = 0;

  const V = nodes.length;
  for (let i = 0; i < V; i++) {
    let changed = false;
    for (const edge of edges) {
      const u = edge.source;
      const v = edge.target;
      if (layerMap[u] !== undefined && layerMap[v] !== undefined) {
        if (layerMap[u] + 1 > layerMap[v]) {
          layerMap[v] = layerMap[u] + 1;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const layers: Record<number, string[]> = {};
  for (const node of nodes) {
    const l = layerMap[node.id];
    if (!layers[l]) layers[l] = [];
    layers[l].push(node.id);
  }

  for (const [layerStr, nodeIds] of Object.entries(layers)) {
    const layer = Number.parseInt(layerStr, 10);
    const x = layer * (NODE_WIDTH + HORIZONTAL_SPACING);
    const totalHeight = nodeIds.length * NODE_HEIGHT + (nodeIds.length - 1) * VERTICAL_SPACING;
    const startY = -totalHeight / 2;
    nodeIds.forEach((nodeId, index) => {
      const y = startY + index * (NODE_HEIGHT + VERTICAL_SPACING);
      positions.set(nodeId, { x, y });
    });
  }

  return positions;
}

export const LOGIC_LAYOUT_CONSTANTS = {
  NODE_WIDTH,
  NODE_HEIGHT,
  HORIZONTAL_SPACING,
  VERTICAL_SPACING
} as const;
