import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function write(root: string, path: string, content: string): Promise<void> {
  const fullPath = join(root, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${content.endsWith("\n") ? content : `${content}\n`}`);
}

export function hostFromAppDomain(appDomain: string): string {
  try {
    return new URL(appDomain).host;
  } catch {
    return appDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}
