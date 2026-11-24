import { HttpError } from "./http";

/**
 * The live demo runs on a free tier: the backend sleeps and needs about a minute to
 * start. Until then the proxy answers with a gateway error or no answer at all.
 */
export const SLOW_START_HINT_MS = 3_000;
export const WAKE_UP_RETRY_MS = 5_000;
export const WAKE_UP_LIMIT_MS = 120_000;

const WAKE_UP_STATUSES = [502, 503, 504];

/** A gateway error, or no answer at all (fetch rejects with a TypeError). */
export function isWakingUp(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof HttpError && WAKE_UP_STATUSES.includes(error.status))
  );
}

/**
 * For TanStack Query's `retry` (failureCount starts at 0): retry a waking backend every
 * WAKE_UP_RETRY_MS until WAKE_UP_LIMIT_MS have passed; other errors are not retried.
 */
export function shouldRetryWakeUp(failureCount: number, error: unknown): boolean {
  return isWakingUp(error) && failureCount < WAKE_UP_LIMIT_MS / WAKE_UP_RETRY_MS;
}
