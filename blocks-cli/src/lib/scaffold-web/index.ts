import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { writeAppCore } from "./app-core.js";
import { writeAssetsFeature } from "./assets-feature.js";
import { writeAuthPages } from "./auth-pages.js";
import { writeBlocksLib } from "./blocks-lib.js";
import { writeDashboard } from "./dashboard.js";
import { writeI18n } from "./i18n.js";
import { writeLayout } from "./layout.js";
import { writeProfileFeature } from "./profile-feature.js";
import { writeRootFiles } from "./root-files.js";
import { writeRouter } from "./router.js";
import { writeStyles } from "./styles.js";
import { writeUiBasics } from "./ui-basics.js";
import { writeUiPrimitives } from "./ui-primitives.js";
import type { WebOptions } from "./types.js";

export type { WebOptions } from "./types.js";

// Generates the full Blocks React/Vite starter app. Split into one module
// per app area (see the doc comment atop each writeXxx function) instead of
// one monolithic file -- each write() call is independent (no ordering
// dependency between generated files), so the split is purely organizational.
export async function scaffoldWebProject(options: WebOptions): Promise<void> {
  const root = join(process.cwd(), options.name);
  await mkdir(root, { recursive: true });

  await writeRootFiles(root, options);
  await writeAppCore(root);
  await writeI18n(root);
  await writeRouter(root);
  await writeUiPrimitives(root);
  await writeLayout(root);
  await writeBlocksLib(root);
  await writeUiBasics(root);
  await writeAuthPages(root);
  await writeDashboard(root);
  await writeAssetsFeature(root);
  await writeProfileFeature(root);
  await writeStyles(root);
}
