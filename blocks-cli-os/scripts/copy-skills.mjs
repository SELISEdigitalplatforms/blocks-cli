#!/usr/bin/env node
// Bundles the monorepo root's blocks-skills/ content into dist/skills so a
// published npm install of this package can serve 'skill:list'/'skill:show'/
// 'skill:add' without the rest of the monorepo. See src/lib/skills.ts.
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(packageRoot, "..", "blocks-skills");
const destination = join(packageRoot, "dist", "skills");

if (!existsSync(source)) {
  console.warn(`Skipping skill bundling: no blocks-skills folder found at ${source}.`);
  process.exit(0);
}

cpSync(source, destination, { recursive: true });
console.log(`Bundled blocks-skills -> ${destination}`);
