/**
 * Drops leading and trailing `/` from a caller-supplied sub-path. A loop rather than
 * `/^\/+|\/+$/g`: that pattern backtracks quadratically on a long run of slashes that
 * does not end the string, and the path comes straight from app code.
 */
export function trimSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "/") start++;
  while (end > start && value[end - 1] === "/") end--;
  return value.slice(start, end);
}
