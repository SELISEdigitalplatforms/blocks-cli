import { randomUUID } from "node:crypto";
import { CliActionableError } from "./errors.js";
import {
  applyLogicSafetyFixup,
  getLogicNodeType,
  knownLogicNodeTypes,
  needsLogicRuntimeConfig,
  type LogicRuntimeFixupContext
} from "./logic-catalog.js";
import { getLayoutedElements } from "./logic-layout.js";
import { parseLogicYaml } from "./logic-yaml.js";

export type WorkflowExportNode = {
  id: string;
  name: string;
  category: string;
  type: string;
  version: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  settings: Record<string, unknown>;
  pinData: null;
};

export type WorkflowExportEdge = {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
};

export type WorkflowExportFile = {
  name: string;
  settings: Record<string, unknown>;
  nodes: WorkflowExportNode[];
  edges: WorkflowExportEdge[];
};

export type CompileResult = {
  compiled: WorkflowExportFile;
  messageCoRelationId: string;
  typesUsed: string[];
};

type AuthorNode = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  category?: unknown;
  version?: unknown;
  parameters?: unknown;
  settings?: unknown;
};

type AuthorEdge = {
  from?: unknown;
  to?: unknown;
  fromHandle?: unknown;
  toHandle?: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWorkflowSource(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new CliActionableError("A workflow needs at least one node.", "logic_bad_shape");
  }
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new CliActionableError(
        `Could not parse workflow JSON: ${(error as Error).message}`,
        "logic_bad_shape"
      );
    }
  }
  return parseLogicYaml(text);
}

export function compileWorkflowDocument(
  raw: unknown,
  fixupCtx: LogicRuntimeFixupContext = {},
  options: { messageCoRelationId?: string } = {}
): CompileResult {
  if (!isPlainObject(raw)) {
    throw new CliActionableError("Workflow root must be a mapping/object.", "logic_bad_shape");
  }

  const name = raw.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new CliActionableError("Workflow 'name' is required.", "logic_bad_shape");
  }

  const settings = raw.settings === undefined ? {} : raw.settings;
  if (!isPlainObject(settings)) {
    throw new CliActionableError("Workflow 'settings' must be a mapping/object.", "logic_bad_shape");
  }

  if (!Array.isArray(raw.nodes)) {
    throw new CliActionableError("Workflow 'nodes' must be an array.", "logic_bad_shape");
  }
  if (raw.nodes.length === 0) {
    throw new CliActionableError("A workflow needs at least one node.", "logic_bad_shape");
  }

  const edgesRaw = raw.edges === undefined ? [] : raw.edges;
  if (!Array.isArray(edgesRaw)) {
    throw new CliActionableError("Workflow 'edges' must be an array.", "logic_bad_shape");
  }

  const seenIds = new Set<string>();
  const authorNodes: Array<{
    id: string;
    name: string;
    type: string;
    category: string;
    version: string;
    parameters: Record<string, unknown>;
    settings: Record<string, unknown>;
  }> = [];

  for (const item of raw.nodes) {
    if (!isPlainObject(item)) {
      throw new CliActionableError("Each node must be a mapping/object.", "logic_bad_shape");
    }
    const node = item as AuthorNode;
    if (typeof node.id !== "string" || !node.id) {
      throw new CliActionableError("Each node needs a non-empty 'id'.", "logic_bad_shape");
    }
    if (seenIds.has(node.id)) {
      throw new CliActionableError(
        `Node id '${node.id}' is used more than once in this file.`,
        "logic_duplicate_node_id"
      );
    }
    seenIds.add(node.id);

    if (typeof node.name !== "string" || !node.name) {
      throw new CliActionableError(`Node '${node.id}' needs a non-empty 'name'.`, "logic_bad_shape");
    }
    if (typeof node.type !== "string" || !node.type) {
      throw new CliActionableError(`Node '${node.id}' needs a 'type'.`, "logic_bad_shape");
    }

    const def = getLogicNodeType(node.type);
    if (!def) {
      throw new CliActionableError(
        `Node '${node.id}' has type '${node.type}', which is not one of the known building blocks: ${knownLogicNodeTypes().join(", ")}.`,
        "logic_unknown_node_type"
      );
    }

    const parameters = node.parameters === undefined ? {} : node.parameters;
    if (!isPlainObject(parameters)) {
      throw new CliActionableError(`Node '${node.id}' parameters must be a mapping/object.`, "logic_bad_shape");
    }
    const nodeSettings = node.settings === undefined ? {} : node.settings;
    if (!isPlainObject(nodeSettings)) {
      throw new CliActionableError(`Node '${node.id}' settings must be a mapping/object.`, "logic_bad_shape");
    }

    const category =
      typeof node.category === "string" && node.category ? node.category : def.category;
    const version = typeof node.version === "string" && node.version ? node.version : def.version;

    authorNodes.push({
      id: node.id,
      name: node.name,
      type: node.type,
      category,
      version,
      parameters: { ...parameters },
      settings: { ...nodeSettings }
    });
  }

  const typesUsed = authorNodes.map((n) => n.type);
  const need = needsLogicRuntimeConfig(typesUsed);
  if (need.agents && !fixupCtx.agentsBaseUrl) {
    throw new CliActionableError(
      "Could not resolve blocks-logic's BLOCKS_AGENTS_BASE_URL for an 'agent' node.",
      "logic_runtime_config_unavailable"
    );
  }
  if (need.data && !fixupCtx.dataBaseUrl) {
    throw new CliActionableError(
      "Could not resolve blocks-logic's BLOCKS_DATA_BASE_URL for a 'dataAction' node.",
      "logic_runtime_config_unavailable"
    );
  }

  const compiledEdges: WorkflowExportEdge[] = [];
  for (const item of edgesRaw) {
    if (!isPlainObject(item)) {
      throw new CliActionableError("Each edge must be a mapping/object.", "logic_bad_shape");
    }
    const edge = item as AuthorEdge;
    if (typeof edge.from !== "string" || !edge.from) {
      throw new CliActionableError("Each edge needs a 'from' node id.", "logic_bad_shape");
    }
    if (typeof edge.to !== "string" || !edge.to) {
      throw new CliActionableError("Each edge needs a 'to' node id.", "logic_bad_shape");
    }
    if (!seenIds.has(edge.from)) {
      throw new CliActionableError(
        `Edge references node id '${edge.from}', which is not defined in this file.`,
        "logic_edge_unknown_node"
      );
    }
    if (!seenIds.has(edge.to)) {
      throw new CliActionableError(
        `Edge references node id '${edge.to}', which is not defined in this file.`,
        "logic_edge_unknown_node"
      );
    }

    const fromNode = authorNodes.find((n) => n.id === edge.from)!;
    const toNode = authorNodes.find((n) => n.id === edge.to)!;
    const fromDef = getLogicNodeType(fromNode.type)!;
    const toDef = getLogicNodeType(toNode.type)!;

    let sourceHandle: string;
    if (typeof edge.fromHandle === "string" && edge.fromHandle) {
      if (!fromDef.handleSpec.source.includes(edge.fromHandle)) {
        throw new CliActionableError(
          `Edge from '${edge.from}' uses handle '${edge.fromHandle}', but node type '${fromNode.type}' only has: ${fromDef.handleSpec.source.join(", ")}.`,
          "logic_unknown_handle"
        );
      }
      sourceHandle = edge.fromHandle;
    } else if (fromDef.handleSpec.source.length === 1) {
      sourceHandle = fromDef.handleSpec.source[0];
    } else if (fromDef.handleSpec.source.length === 0) {
      throw new CliActionableError(
        `Edge from '${edge.from}' cannot leave node type '${fromNode.type}' (no source handles).`,
        "logic_unknown_handle"
      );
    } else {
      throw new CliActionableError(
        `Edge from '${edge.from}' needs fromHandle because node type '${fromNode.type}' has multiple source handles: ${fromDef.handleSpec.source.join(", ")}.`,
        "logic_unknown_handle"
      );
    }

    let targetHandle: string;
    if (typeof edge.toHandle === "string" && edge.toHandle) {
      if (!toDef.handleSpec.target.includes(edge.toHandle)) {
        throw new CliActionableError(
          `Edge to '${edge.to}' uses handle '${edge.toHandle}', but node type '${toNode.type}' only has: ${toDef.handleSpec.target.join(", ") || "(none)"}.`,
          "logic_unknown_handle"
        );
      }
      targetHandle = edge.toHandle;
    } else if (toDef.handleSpec.target.length === 1) {
      targetHandle = toDef.handleSpec.target[0];
    } else if (toDef.handleSpec.target.length === 0) {
      throw new CliActionableError(
        `Edge to '${edge.to}' cannot enter node type '${toNode.type}' (no target handles).`,
        "logic_unknown_handle"
      );
    } else {
      targetHandle = "target";
      if (!toDef.handleSpec.target.includes(targetHandle)) {
        throw new CliActionableError(
          `Edge to '${edge.to}' needs toHandle because node type '${toNode.type}' has multiple target handles: ${toDef.handleSpec.target.join(", ")}.`,
          "logic_unknown_handle"
        );
      }
    }

    compiledEdges.push({
      source: edge.from,
      target: edge.to,
      sourceHandle,
      targetHandle
    });
  }

  const layout = getLayoutedElements(
    authorNodes.map((n) => ({ id: n.id, position: { x: 0, y: 0 } })),
    compiledEdges.map((e) => ({ source: e.source, target: e.target }))
  );

  const compiledNodes: WorkflowExportNode[] = authorNodes.map((n) => {
    const position = layout.get(n.id) ?? { x: 0, y: 0 };
    const parameters = applyLogicSafetyFixup(n.type, n.parameters, fixupCtx);
    // webhook path fixup from schema also sets path to node id when transforming;
    // only apply path default when missing so authors can override.
    if (n.type === "webhook" && (parameters.path === undefined || parameters.path === "")) {
      parameters.path = n.id;
    }
    return {
      id: n.id,
      name: n.name,
      category: n.category,
      type: n.type,
      version: n.version,
      position,
      parameters,
      settings: n.settings,
      pinData: null
    };
  });

  return {
    compiled: {
      name: name.trim(),
      settings: { ...settings },
      nodes: compiledNodes,
      edges: compiledEdges
    },
    messageCoRelationId: options.messageCoRelationId ?? randomUUID(),
    typesUsed
  };
}

export function compileWorkflowFileText(
  text: string,
  fixupCtx: LogicRuntimeFixupContext = {},
  options: { messageCoRelationId?: string } = {}
): CompileResult {
  return compileWorkflowDocument(parseWorkflowSource(text), fixupCtx, options);
}
