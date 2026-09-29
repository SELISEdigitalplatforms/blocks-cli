import { stringFlag } from "../../../lib/args.js";
import {
  listProxies,
  parseProxyListActiveFilter,
  parseProxyListPaging
} from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** List proxies from blocks-logic Proxies (verbatim). */
export async function logicProxyList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const search = stringFlag(flags, "search") || undefined;
  const isActive = parseProxyListActiveFilter(flags);
  const { page, pageSize } = parseProxyListPaging(flags);

  const result = await listProxies({
    projectKey,
    flags,
    search,
    isActive,
    page,
    pageSize
  });
  writeOutput(result, flags);
}
