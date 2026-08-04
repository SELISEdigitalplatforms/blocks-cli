import { spawn } from "node:child_process";
import { platform } from "node:os";

const LAUNCH_GRACE_PERIOD_MS = 500;

export async function openBrowser(url: string): Promise<boolean> {
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
