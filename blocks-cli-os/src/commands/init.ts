import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaults } from "../lib/config.js";

export async function init(): Promise<void> {
  const env = defaults();
  await mkdir(join(process.cwd(), "blocks", "data", "schemas"), { recursive: true });
  await mkdir(join(process.cwd(), "blocks", "localization"), { recursive: true });
  await mkdir(join(process.cwd(), "blocks", "release"), { recursive: true });

  await writeIfMissing("blocks.json", `${JSON.stringify({
    project: {
      tenantId: "",
      apiUrl: env.apiUrl,
      appDomain: ""
    },
    data: {
      schemas: "blocks/data/schemas",
      rules: "blocks/data/rules.json"
    },
    localization: {
      dictionaries: "blocks/localization"
    },
    release: {
      config: "blocks/release/deploy.json"
    }
  }, null, 2)}\n`);

  await writeIfMissing(join("blocks", "data", "rules.json"), `${JSON.stringify({
    policies: []
  }, null, 2)}\n`);

  await writeIfMissing(join("blocks", "release", "deploy.json"), `${JSON.stringify({
    target: "",
    strategy: "configured-pipeline"
  }, null, 2)}\n`);

  await writeIfMissing(".env.example", [
    `VITE_BLOCKS_API_URL=${env.apiUrl}`,
    "VITE_BLOCKS_X_BLOCKS_KEY=",
    "VITE_BLOCKS_APP_DOMAIN=",
    ""
  ].join("\n"));

  console.log("Initialized Blocks workspace.");
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
