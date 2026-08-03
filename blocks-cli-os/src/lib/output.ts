export function writeOutput(data: unknown, flags: Record<string, string | boolean>): void {
  if (flags.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (typeof data === "string") {
    console.log(data);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

export function writeLines(lines: string[], flags: Record<string, string | boolean>): void {
  if (flags.json) {
    console.log(JSON.stringify(lines, null, 2));
    return;
  }

  for (const line of lines) console.log(line);
}
