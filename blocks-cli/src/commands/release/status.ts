import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { writeOutput } from "../../lib/output.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_WAIT_TIMEOUT_SECONDS,
  buildStatusOf,
  classifyBuildStatus,
  getBuild,
  waitForBuild
} from "../../lib/release.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function releaseStatus(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const buildId = args[0] || stringFlag(flags, "build-id", { required: true });
  const wait = booleanFlag(flags, "wait");
  const follow = booleanFlag(flags, "follow");
  const projectKey = await selectedProject(flags);

  if (wait || follow) {
    const { build, status, verdict } = await waitForBuild(buildId, projectKey, flags, {
      followLogs: follow,
      pollIntervalSeconds: integerFlag(flags, "poll-interval", DEFAULT_POLL_INTERVAL_SECONDS),
      timeoutSeconds: integerFlag(flags, "timeout", DEFAULT_WAIT_TIMEOUT_SECONDS)
    });
    writeOutput({ build, buildId, status, verdict }, flags);
    return;
  }

  const build = await getBuild(buildId, projectKey, flags);
  const status = buildStatusOf(build);
  writeOutput({ build, buildId, status, verdict: classifyBuildStatus(status) }, flags);
}
