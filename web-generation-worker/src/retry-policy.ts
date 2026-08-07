export function shouldRetry(
  retryable: boolean,
  attempts: number,
  maxAttempts: number
): boolean {
  return retryable && attempts < maxAttempts;
}

export function retryDelaySeconds(
  attempt: number,
  random: () => number = Math.random
): number {
  const base = attempt <= 1 ? 30 : 90;
  return Math.max(1, Math.round(base * (0.8 + random() * 0.4)));
}
