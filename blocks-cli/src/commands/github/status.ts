import { getGithubConnection } from "../../lib/github.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function githubStatus(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const connection = await getGithubConnection(projectKey, flags);
  if (connection.connected) {
    writeOutput({ connected: true, login: connection.login }, flags);
    return;
  }
  writeOutput({ connected: false }, flags);
}
