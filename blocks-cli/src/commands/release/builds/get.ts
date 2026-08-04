import { releaseStatus } from "../status.js";

export async function releaseBuildsGet(argv: string[]): Promise<void> {
  await releaseStatus(argv);
}
