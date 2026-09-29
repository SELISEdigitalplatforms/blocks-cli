/**
 * Minimal YAML subset parser for workflow-as-code files.
 * Supports: indentation maps, `-` lists, quoted/unquoted scalars, flow `{...}` / `[...]`,
 * nested structures used by the logic push DSL. Not a full YAML 1.2 implementation.
 */

import { CliActionableError } from "./errors.js";

type YamlValue = null | boolean | number | string | YamlValue[] | { [key: string]: YamlValue };

export function parseLogicYaml(text: string): unknown {
  const lines = preprocess(text);
  if (lines.length === 0) {
    throw new CliActionableError("Workflow file is empty.", "logic_bad_shape");
  }
  const { value, next } = parseBlock(lines, 0, 0);
  if (next < lines.length) {
    throw new CliActionableError(
      `Unexpected content at line ${lines[next].lineNo}.`,
      "logic_bad_shape"
    );
  }
  return value;
}

type Line = { indent: number; content: string; lineNo: number };

function preprocess(text: string): Line[] {
  const out: Line[] = [];
  const raw = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i = 0; i < raw.length; i++) {
    const original = raw[i];
    const stripped = original.replace(/#.*$/, "");
    if (!stripped.trim()) continue;
    const indent = stripped.match(/^ */)?.[0].length ?? 0;
    if (stripped.slice(indent).startsWith("\t")) {
      throw new CliActionableError(
        `Tabs are not allowed for indentation (line ${i + 1}).`,
        "logic_bad_shape"
      );
    }
    out.push({ indent, content: stripped.slice(indent), lineNo: i + 1 });
  }
  return out;
}

function parseBlock(lines: Line[], index: number, minIndent: number): { value: YamlValue; next: number } {
  if (index >= lines.length || lines[index].indent < minIndent) {
    return { value: null, next: index };
  }
  const first = lines[index];
  if (first.content.startsWith("- ")) {
    return parseList(lines, index, first.indent);
  }
  return parseMap(lines, index, first.indent);
}

function parseMap(lines: Line[], index: number, indent: number): { value: YamlValue; next: number } {
  const result: { [key: string]: YamlValue } = {};
  let i = index;
  while (i < lines.length && lines[i].indent === indent) {
    const line = lines[i];
    if (line.content.startsWith("- ")) {
      throw new CliActionableError(`Unexpected list item at line ${line.lineNo}.`, "logic_bad_shape");
    }
    const colon = findMapColon(line.content);
    if (colon < 0) {
      throw new CliActionableError(`Expected key: value at line ${line.lineNo}.`, "logic_bad_shape");
    }
    const key = line.content.slice(0, colon).trim();
    const rest = line.content.slice(colon + 1).trim();
    if (!key) {
      throw new CliActionableError(`Empty key at line ${line.lineNo}.`, "logic_bad_shape");
    }
    if (rest.length > 0) {
      result[unquote(key)] = parseFlowOrScalar(rest, line.lineNo);
      i += 1;
      continue;
    }
    // Nested block
    if (i + 1 >= lines.length || lines[i + 1].indent <= indent) {
      result[unquote(key)] = null;
      i += 1;
      continue;
    }
    const childIndent = lines[i + 1].indent;
    if (childIndent <= indent) {
      result[unquote(key)] = null;
      i += 1;
      continue;
    }
    const nested = parseBlock(lines, i + 1, childIndent);
    result[unquote(key)] = nested.value;
    i = nested.next;
  }
  return { value: result, next: i };
}

function parseList(lines: Line[], index: number, indent: number): { value: YamlValue; next: number } {
  const result: YamlValue[] = [];
  let i = index;
  while (i < lines.length && lines[i].indent === indent && lines[i].content.startsWith("- ")) {
    const line = lines[i];
    const rest = line.content.slice(2).trim();
    if (rest.length === 0) {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const nested = parseBlock(lines, i + 1, lines[i + 1].indent);
        result.push(nested.value);
        i = nested.next;
        continue;
      }
      result.push(null);
      i += 1;
      continue;
    }
    // Inline map on list item: `- id: trigger`
    const colon = findMapColon(rest);
    if (colon > 0 && !rest.startsWith("{") && !rest.startsWith("[")) {
      const key = rest.slice(0, colon).trim();
      const after = rest.slice(colon + 1).trim();
      const obj: { [key: string]: YamlValue } = {};
      if (after.length > 0) {
        obj[unquote(key)] = parseFlowOrScalar(after, line.lineNo);
        i += 1;
        // Continuation keys at greater indent
        while (i < lines.length && lines[i].indent > indent && !lines[i].content.startsWith("- ")) {
          const cont = lines[i];
          const cColon = findMapColon(cont.content);
          if (cColon < 0) {
            throw new CliActionableError(`Expected key: value at line ${cont.lineNo}.`, "logic_bad_shape");
          }
          const cKey = cont.content.slice(0, cColon).trim();
          const cRest = cont.content.slice(cColon + 1).trim();
          if (cRest.length > 0) {
            obj[unquote(cKey)] = parseFlowOrScalar(cRest, cont.lineNo);
            i += 1;
          } else if (i + 1 < lines.length && lines[i + 1].indent > cont.indent) {
            const nested = parseBlock(lines, i + 1, lines[i + 1].indent);
            obj[unquote(cKey)] = nested.value;
            i = nested.next;
          } else {
            obj[unquote(cKey)] = null;
            i += 1;
          }
        }
        result.push(obj);
        continue;
      }
    }
    result.push(parseFlowOrScalar(rest, line.lineNo));
    i += 1;
  }
  return { value: result, next: i };
}

function findMapColon(content: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ":" && !inSingle && !inDouble) {
      const next = content[i + 1];
      if (next === undefined || next === " " || next === "\t") return i;
      // allow `key:` at end
      if (i === content.length - 1) return i;
    }
  }
  return -1;
}

function parseFlowOrScalar(text: string, lineNo: number): YamlValue {
  const t = text.trim();
  if (t.startsWith("{")) return parseFlowMap(t, lineNo);
  if (t.startsWith("[")) return parseFlowList(t, lineNo);
  return parseScalar(t);
}

function parseFlowMap(text: string, lineNo: number): YamlValue {
  if (!text.endsWith("}")) {
    throw new CliActionableError(`Unclosed flow map at line ${lineNo}.`, "logic_bad_shape");
  }
  const inner = text.slice(1, -1).trim();
  if (!inner) return {};
  const result: { [key: string]: YamlValue } = {};
  for (const part of splitFlow(inner)) {
    const colon = findMapColon(part);
    if (colon < 0) {
      throw new CliActionableError(`Invalid flow map entry '${part}' at line ${lineNo}.`, "logic_bad_shape");
    }
    const key = part.slice(0, colon).trim();
    const val = part.slice(colon + 1).trim();
    result[unquote(key)] = parseFlowOrScalar(val, lineNo);
  }
  return result;
}

function parseFlowList(text: string, lineNo: number): YamlValue {
  if (!text.endsWith("]")) {
    throw new CliActionableError(`Unclosed flow list at line ${lineNo}.`, "logic_bad_shape");
  }
  const inner = text.slice(1, -1).trim();
  if (!inner) return [];
  return splitFlow(inner).map((part) => parseFlowOrScalar(part, lineNo));
}

function splitFlow(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === "{" || ch === "[") depth += 1;
      else if (ch === "}" || ch === "]") depth -= 1;
      else if (ch === "," && depth === 0) {
        parts.push(inner.slice(start, i).trim());
        start = i + 1;
      }
    }
  }
  parts.push(inner.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}

function parseScalar(text: string): YamlValue {
  if (text === "null" || text === "~" || text === "") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return unquote(text);
  }
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function unquote(text: string): string {
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}
