import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaults } from "../lib/config.js";
import { parseFlags } from "../lib/args.js";
import { writeOutput } from "../lib/output.js";

export async function init(argv: string[] = []): Promise<void> {
  const { flags } = parseFlags(argv);
  const env = defaults();
  const created: string[] = [];
  const existing: string[] = [];
  await mkdir(join(process.cwd(), "blocks", "data", "schemas"), { recursive: true });

  await trackWrite("blocks.json", `${JSON.stringify({
    project: {
      tenantId: "",
      apiUrl: env.apiUrl,
      appDomain: ""
    },
    data: {
      schemas: "blocks/data/schemas",
      rules: "blocks/data/rules.json"
    }
  }, null, 2)}\n`);

  await trackWrite(join("blocks", "data", "rules.json"), `${JSON.stringify({
    policies: []
  }, null, 2)}\n`);

  await trackWrite(".env.example", [
    `VITE_BLOCKS_API_URL=${env.apiUrl}`,
    "VITE_BLOCKS_X_BLOCKS_KEY=",
    "VITE_BLOCKS_APP_DOMAIN=",
    ""
  ].join("\n"));

  if (flags.json) writeOutput({ created, existing, initialized: true }, flags);
  else console.log("Initialized Blocks workspace.");

  async function trackWrite(path: string, content: string): Promise<void> {
    (await writeIfMissing(path, content) ? created : existing).push(path);
  }
}

async function writeIfMissing(path: string, content: string): Promise<boolean> {
  try {
    await writeFile(path, content, { flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  }
}
