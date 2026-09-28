import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hostFromAppDomain } from "../domains.js";

export { hostFromAppDomain };

export async function write(root: string, path: string, content: string): Promise<void> {
  const fullPath = join(root, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${content.endsWith("\n") ? content : `${content}\n`}`);
}

