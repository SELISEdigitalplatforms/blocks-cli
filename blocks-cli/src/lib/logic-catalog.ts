/**
 * Embedded, versioned copy of blocks-logic's node-type catalog (A1).
 * Source of truth: blocks-logic client node-definitions.tsx + NodeSchema transforms.
 */

export type LogicNodeCategory = "trigger" | "action" | "logic" | "transform";

export type LogicHandleSpec = {
  source: string[];
  target: string[];
};

export type LogicNodeTypeDef = {
  type: string;
  category: LogicNodeCategory;
  version: string;
  handleSpec: LogicHandleSpec;
};

export const LOGIC_CATALOG_VERSION = "v1-2026-09";

export const LOGIC_NODE_TYPES: readonly LogicNodeTypeDef[] = [
  { type: "webhook", category: "trigger", version: "v1", handleSpec: { source: ["source"], target: [] } },
  { type: "email", category: "trigger", version: "v1", handleSpec: { source: ["source"], target: [] } },
  { type: "dataGateway", category: "trigger", version: "v1", handleSpec: { source: ["source"], target: [] } },
  { type: "schedule", category: "trigger", version: "v1", handleSpec: { source: ["source"], target: [] } },
  { type: "agent", category: "action", version: "v1", handleSpec: { source: ["source"], target: ["target"] } },
  { type: "sendMail", category: "action", version: "v1", handleSpec: { source: ["source"], target: ["target"] } },
  { type: "httpRequest", category: "action", version: "v1", handleSpec: { source: ["source"], target: ["target"] } },
  { type: "proxy", category: "action", version: "v1", handleSpec: { source: ["source"], target: ["target"] } },
  { type: "dataAction", category: "action", version: "v1", handleSpec: { source: ["source"], target: ["target"] } },
  { type: "if", category: "logic", version: "v1", handleSpec: { source: ["if-true", "if-false"], target: ["target"] } },
  { type: "setfield", category: "transform", version: "v1", handleSpec: { source: ["source"], target: ["target"] } },
  { type: "code", category: "transform", version: "v1", handleSpec: { source: ["source"], target: ["target"] } }
] as const;

const BY_TYPE = new Map(LOGIC_NODE_TYPES.map((def) => [def.type, def]));

export function knownLogicNodeTypes(): string[] {
  return LOGIC_NODE_TYPES.map((def) => def.type);
}

export function getLogicNodeType(type: string): LogicNodeTypeDef | undefined {
  return BY_TYPE.get(type);
}

export type LogicRuntimeFixupContext = {
  agentsBaseUrl?: string;
  dataBaseUrl?: string;
  projectShortKey?: string;
};

/**
 * Apply the four load-bearing safety fixups ported from blocks-logic NodeSchema transforms (A2).
 * Other seven types are no-ops.
 */
export function applyLogicSafetyFixup(
  type: string,
  parameters: Record<string, unknown>,
  ctx: LogicRuntimeFixupContext
): Record<string, unknown> {
  const params = { ...parameters };

  if (type === "webhook") {
    const mode = typeof params.authorizationMode === "string" ? params.authorizationMode : "";
    params.authorizationMode = mode || "RolesOnly";
    return params;
  }

  if (type === "agent") {
    if (ctx.agentsBaseUrl) params.ApiBaseUrl = ctx.agentsBaseUrl;
    return params;
  }

  if (type === "dataAction") {
    if (ctx.dataBaseUrl) params.apiBaseUrl = ctx.dataBaseUrl;
    if (ctx.projectShortKey) params.projectShortKey = ctx.projectShortKey;
    return params;
  }

  if (type === "httpRequest") {
    if (!params.authenticationType && params.useBlocksAuthorization === true) {
      params.authenticationType = "blocksAuthentication";
    }
    return params;
  }

  return params;
}

/** Types that need blocks-logic public runtime base URLs injected. */
export function needsLogicRuntimeConfig(types: Iterable<string>): { agents: boolean; data: boolean } {
  let agents = false;
  let data = false;
  for (const type of types) {
    if (type === "agent") agents = true;
    if (type === "dataAction") data = true;
  }
  return { agents, data };
}
