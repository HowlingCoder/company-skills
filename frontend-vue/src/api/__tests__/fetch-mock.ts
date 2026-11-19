import { vi } from 'vitest'

/** Replaces fetch with a mock that answers every request with `body` and `status`. */
export function respondWith(body: unknown, status = 200) {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** URL, method and parsed JSON body of the n-th request. */
export function requestOf(fetchMock: ReturnType<typeof respondWith>, n = 0) {
  const [url, init] = fetchMock.mock.calls[n]!
  return {
    url: String(url),
    method: init?.method ?? 'GET',
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
  }
}
