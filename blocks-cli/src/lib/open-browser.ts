import { spawn } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";
import { platform } from "node:os";

const LAUNCH_GRACE_PERIOD_MS = 500;

/**
 * Opens `url` in the system browser.
 *
 * Test / headless seams (never log secrets):
 * - BLOCKS_OPEN_BROWSER=0|off|false — skip launch, return true
 * - BLOCKS_OPEN_BROWSER=record:<path> — write the URL to that file, return true
 */
export async function openBrowser(url: string): Promise<boolean> {
  const mode = (process.env.BLOCKS_OPEN_BROWSER ?? "").trim().toLowerCase();
  if (mode === "0" || mode === "off" || mode === "false" || mode === "no") return true;
  if (mode.startsWith("record:")) {
    const path = process.env.BLOCKS_OPEN_BROWSER!.slice("record:".length);
    await writeFile(path, `${url}\n`, "utf8");
    return true;
  }
  if (mode.startsWith("append:")) {
    const path = process.env.BLOCKS_OPEN_BROWSER!.slice("append:".length);
    await appendFile(path, `${url}\n`, "utf8");
    return true;
  }

  const os = platform();
  const command = os === "win32" ? "rundll32" : os === "darwin" ? "open" : "xdg-open";
  const args = os === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });

    let settled = false;
    const settle = (result: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.once("error", () => settle(false));

    // A launcher like xdg-open can spawn successfully and still exit
    // non-zero almost immediately when no browser/display session is
    // available (headless SSH, missing DISPLAY, etc.). Give it a short
    // grace period to fail fast before treating the launch as a success
    // and detaching the process.
    const grace = setTimeout(() => {
      child.unref();
      settle(true);
    }, LAUNCH_GRACE_PERIOD_MS);

    child.once("exit", (code) => {
      clearTimeout(grace);
      if (code === 0 || code === null) {
        child.unref();
        settle(true);
      } else {
        settle(false);
      }
    });
  });
}
