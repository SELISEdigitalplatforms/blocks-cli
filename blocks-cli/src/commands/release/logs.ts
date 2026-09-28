import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { writeLines, writeOutput } from "../../lib/output.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_WAIT_TIMEOUT_SECONDS,
  buildEventsOf,
  buildStatusOf,
  classifyBuildStatus,
  formatBuildEvent,
  getBuild,
  waitForBuild
} from "../../lib/release.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Prints a build's stored pipeline events (Clone/Build/Deploy/Sast/Sca stages). With
 * --follow, keeps polling and streaming new events until the build's status field is
 * terminal -- log lines go to stderr in --json mode so stdout stays one document.
 */
export async function releaseLogs(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const buildId = args[0] || stringFlag(flags, "build-id", { required: true });
  const follow = booleanFlag(flags, "follow");
  const group = stringFlag(flags, "group").toLowerCase();
  const projectKey = await selectedProject(flags);

  if (follow) {
    const emit = flags.json ? (line: string) => console.error(line) : (line: string) => console.log(line);
    const { build, status, verdict } = await waitForBuild(buildId, projectKey, flags, {
      followLogs: true,
      onEvent: (line) => emit(line),
      pollIntervalSeconds: integerFlag(flags, "poll-interval", DEFAULT_POLL_INTERVAL_SECONDS),
      timeoutSeconds: integerFlag(flags, "timeout", DEFAULT_WAIT_TIMEOUT_SECONDS)
    });
    const events = filterEvents(buildEventsOf(build), group);
    if (flags.json) {
      writeOutput({ buildId, events, status, verdict }, flags);
    } else {
      console.log(`status: ${status ?? "unknown"} (${verdict})`);
    }
    return;
  }

  const build = await getBuild(buildId, projectKey, flags);
  const status = buildStatusOf(build);
  const events = filterEvents(buildEventsOf(build), group);

  if (flags.json) {
    writeOutput({ buildId, events, status, verdict: classifyBuildStatus(status) }, flags);
    return;
  }

  writeLines(events.map((event) => formatBuildEvent(event)), flags);
  console.log(`status: ${status ?? "unknown"} (${classifyBuildStatus(status)})`);
}

function filterEvents<T extends { eventGroup?: string }>(events: T[], group: string): T[] {
  if (!group) return events;
  return events.filter((event) => (event.eventGroup ?? "").toLowerCase() === group);
}
