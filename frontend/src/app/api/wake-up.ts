import { HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, retry, throwError, timer } from 'rxjs';

/**
 * The live demo runs on a free tier: the backend sleeps and needs about a minute to
 * start. Until then the proxy answers with a gateway error or no answer at all.
 */
export const SLOW_START_HINT_MS = 3_000;
export const WAKE_UP_RETRY_MS = 5_000;
export const WAKE_UP_LIMIT_MS = 120_000;

const WAKE_UP_STATUSES = [0, 502, 503, 504];

/** Retries while the backend is starting, for at most WAKE_UP_LIMIT_MS; other errors pass through. */
export function retryWhileWakingUp<T>(): MonoTypeOperatorFunction<T> {
  const start = Date.now();
  return retry({
    delay: (error: unknown) =>
      error instanceof HttpErrorResponse &&
      WAKE_UP_STATUSES.includes(error.status) &&
      Date.now() - start + WAKE_UP_RETRY_MS <= WAKE_UP_LIMIT_MS
        ? timer(WAKE_UP_RETRY_MS)
        : throwError(() => error),
  });
}
