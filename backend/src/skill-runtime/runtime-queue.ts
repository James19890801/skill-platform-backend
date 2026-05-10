export function normalizeQueueConcurrency(raw: string | number | undefined): number {
  const parsed = Number(raw ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, 10);
}
