import { HttpError } from './http'

/**
 * The live demo runs on a free tier: the backend sleeps and needs about a minute to
 * start. Until then the proxy answers with a gateway error or no answer at all.
 */
export const SLOW_START_HINT_MS = 3_000
export const WAKE_UP_RETRY_MS = 5_000
export const WAKE_UP_LIMIT_MS = 120_000

const WAKE_UP_STATUSES = [502, 503, 504]

/** A gateway error, or no answer at all (fetch rejects with a TypeError). */
function isWakingUp(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof HttpError && WAKE_UP_STATUSES.includes(error.status))
  )
}

/**
 * Retries `load` while the backend is starting, for at most WAKE_UP_LIMIT_MS; other errors
 * are thrown at once. `stillNeeded` stops the retries when the result is no longer wanted.
 */
export async function retryWhileWakingUp<T>(
  load: () => Promise<T>,
  stillNeeded: () => boolean = () => true,
): Promise<T> {
  const start = Date.now()
  for (;;) {
    try {
      return await load()
    } catch (error) {
      const timeLeft = Date.now() - start + WAKE_UP_RETRY_MS <= WAKE_UP_LIMIT_MS
      if (!isWakingUp(error) || !timeLeft) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, WAKE_UP_RETRY_MS))
    if (!stillNeeded()) throw new Error('Superseded by a newer request')
  }
}
