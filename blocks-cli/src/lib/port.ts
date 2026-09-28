import { createServer } from "node:net";

// Binding 0.0.0.0 conflicts with a listener already bound to a specific
// interface (127.0.0.1, a LAN IP, etc) on most OSes, so checking it here
// catches the same collision Vite's own "0.0.0.0"/host-specific bind would hit.
export function isPortFree(port: number, host = "0.0.0.0"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(startPort: number, maxAttempts = 50): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${startPort}-${startPort + maxAttempts - 1}.`);
}
