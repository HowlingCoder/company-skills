import { afterEach, describe, expect, it, vi } from 'vitest'
import { importEmployees } from '../employee-api'
import { errorMessage, HttpError, request, UNEXPECTED_ERROR } from '../http'
import { respondWith } from './fetch-mock'

const respond = (status: number, body: unknown) => respondWith(body, status)

describe('request', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the parsed body', async () => {
    respond(200, [{ id: '1' }])

    expect(await request('/api/x')).toEqual([{ id: '1' }])
  })

  it('throws an HttpError with status and the detail of the backend', async () => {
    respond(404, { detail: 'Skill not found' })

    const error = await request('/api/x', { method: 'PUT' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({ status: 404, detail: 'Skill not found' })
  })

  it('copes with an error body that is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('boom', { status: 500 })),
    )

    const error = await request('/api/x').catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 500, detail: undefined })
  })
})

describe('errorMessage', () => {
  it('uses the detail only for the explained status', () => {
    const notFound = new HttpError('x', 404, 'Employee not found')

    expect(errorMessage(notFound, 404)).toBe('Employee not found')
    expect(errorMessage(notFound, 400)).toBe(UNEXPECTED_ERROR)
    expect(errorMessage(new Error('network'), 404)).toBe(UNEXPECTED_ERROR)
  })
})

describe('importEmployees', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the file as the multipart field "file"', async () => {
    const fetchMock = respond(200, { imported_count: 0, failed_count: 0, imported: [], errors: [] })
    const file = new File(['Lastname,Firstname,E-Mail,Age\n'], 'staff.csv', { type: 'text/csv' })

    await importEmployees(file)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/employees/import')
    expect(init!.method).toBe('POST')
    expect((init!.body as FormData).get('file')).toBe(file)
  })
})
