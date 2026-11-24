import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../http'
import { retryWhileWakingUp } from '../wake-up'

const badGateway = () => new HttpError('GET /api/employees failed: 502', 502, undefined)

describe('retryWhileWakingUp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries every 5 seconds on a gateway error until the backend answers', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(badGateway())
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('employees')

    const result = retryWhileWakingUp(load)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5_001)

    await expect(result).resolves.toBe('employees')
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('gives up after 2 minutes', async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValue(badGateway())

    const result = retryWhileWakingUp(load)
    const outcome = result.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(115_000)
    expect(load).toHaveBeenCalledTimes(24)
    await vi.advanceTimersByTimeAsync(5_000)

    expect(await outcome).toBeInstanceOf(HttpError)
    expect(load).toHaveBeenCalledTimes(25)
  })

  it('throws other errors at once', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new HttpError('failed: 500', 500, undefined))

    await expect(retryWhileWakingUp(load)).rejects.toMatchObject({ status: 500 })
    expect(load).toHaveBeenCalledOnce()
  })

  it('stops when the result is no longer needed', async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValue(badGateway())

    const outcome = retryWhileWakingUp(load, () => false).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(5_000)

    expect(await outcome).toBeInstanceOf(Error)
    expect(load).toHaveBeenCalledOnce()
  })
})
