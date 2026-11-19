import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listEmployees } from '@/api/employee-api'
import { employees } from '@/__tests__/fixtures'
import { useEmployeesStore } from '../employees'

vi.mock('@/api/employee-api')

/** A promise the test resolves or rejects by hand, to look at the state in between. */
function pending<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('employees store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listEmployees).mockReset()
  })

  it('starts in the loading state without employees', () => {
    const store = useEmployeesStore()

    expect(store.status).toBe('loading')
    expect(store.employees).toEqual([])
  })

  it('holds the employees after a successful load', async () => {
    vi.mocked(listEmployees).mockResolvedValue(employees)
    const store = useEmployeesStore()

    await store.load()

    expect(listEmployees).toHaveBeenCalledOnce()
    expect(store.status).toBe('loaded')
    expect(store.employees).toEqual(employees)
    expect(store.loading).toBe(false)
  })

  it('reports an error when the request fails', async () => {
    vi.mocked(listEmployees).mockRejectedValue(new Error('GET /api/employees failed: 500'))
    const store = useEmployeesStore()

    await store.load()

    expect(store.status).toBe('error')
    expect(store.loading).toBe(false)
  })

  it('keeps the loaded employees visible while a reload is running', async () => {
    vi.mocked(listEmployees).mockResolvedValue(employees)
    const store = useEmployeesStore()
    await store.load()
    const reload = pending<typeof employees>()
    vi.mocked(listEmployees).mockReturnValue(reload.promise)

    const done = store.load()

    expect(store.loading).toBe(true)
    expect(store.status).toBe('loaded')
    expect(store.employees).toEqual(employees)
    reload.resolve([employees[1]!])
    await done
    expect(store.loading).toBe(false)
    expect(store.employees).toEqual([employees[1]])
  })

  it('recovers from an error on the next successful load', async () => {
    vi.mocked(listEmployees).mockRejectedValueOnce(new Error('boom'))
    vi.mocked(listEmployees).mockResolvedValueOnce(employees)
    const store = useEmployeesStore()

    await store.load()
    await store.load()

    expect(store.status).toBe('loaded')
    expect(store.employees).toEqual(employees)
  })
})

describe('employees store with a filter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listEmployees).mockReset()
  })

  it('passes the filter to the API', async () => {
    vi.mocked(listEmployees).mockResolvedValue([])
    const store = useEmployeesStore()

    await store.load({ q: 'max', minLevel: 3 })

    expect(listEmployees).toHaveBeenCalledWith({ q: 'max', minLevel: 3 })
  })

  it('keeps the newest result when an older answer arrives later', async () => {
    const older = pending<typeof employees>()
    const newer = pending<typeof employees>()
    vi.mocked(listEmployees).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const store = useEmployeesStore()

    const first = store.load({ q: 'a' })
    const second = store.load({ q: 'anna' })
    newer.resolve([employees[1]!])
    await second
    older.resolve(employees)
    await first

    expect(store.employees).toEqual([employees[1]])
    expect(store.loading).toBe(false)
  })

  it('ignores an older failure once a newer search answered', async () => {
    const older = pending<typeof employees>()
    vi.mocked(listEmployees).mockReturnValueOnce(older.promise).mockResolvedValueOnce(employees)
    const store = useEmployeesStore()

    const first = store.load({ q: 'a' })
    await store.load({ q: 'an' })
    older.reject(new Error('boom'))
    await first

    expect(store.status).toBe('loaded')
  })
})
