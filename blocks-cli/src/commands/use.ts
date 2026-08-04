import { saveSelectedProject } from "../lib/workspace.js";

export async function useProject(argv: string[]): Promise<void> {
  const tenantId = argv[0];
  if (!tenantId) throw new Error("Missing project tenant id.");

  await saveSelectedProject(tenantId);
  console.log(`Selected project tenant ${tenantId}`);
  console.log("Root/account session is kept for OS project APIs. Project impersonation is created lazily when a service command needs it.");
}
