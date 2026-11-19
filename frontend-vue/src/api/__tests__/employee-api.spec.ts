import { afterEach, describe, expect, it, vi } from 'vitest'
import { listEmployees, setSkills } from '../employee-api'
import { HttpError } from '../http'
import { type Employee } from '../models'
import { requestOf, respondWith } from './fetch-mock'

describe('employee API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests all employees without query params when no filter is given', async () => {
    const employees: Employee[] = [
      {
        id: '7b0c1f0e-0000-4000-8000-000000000001',
        firstname: 'Max',
        lastname: 'Muster',
        email: 'max.muster@example.com',
        age: 34,
        skills: [
          {
            skill_id: '7b0c1f0e-0000-4000-8000-000000000002',
            name: 'Kubernetes',
            alias: 'K8s',
            proficiency_level: 4,
            matched: false,
          },
        ],
      },
    ]
    const fetchMock = respondWith(employees)

    const result = await listEmployees()

    expect(requestOf(fetchMock)).toMatchObject({ url: '/api/employees', method: 'GET' })
    expect(result).toEqual(employees)
  })

  it('sends every skill term as a repeated skills param', async () => {
    const fetchMock = respondWith([])

    await listEmployees({ skills: ['Python', 'K8s'], skillMatch: 'or', minLevel: 3 })

    expect(requestOf(fetchMock).url).toBe(
      '/api/employees?skills=Python&skills=K8s&skill_match=or&min_level=3',
    )
  })

  it('omits blank filter values instead of sending empty params', async () => {
    const fetchMock = respondWith([])

    await listEmployees({ q: '   ', skills: ['', '  '], skillMatch: 'or' })

    expect(requestOf(fetchMock).url).toBe('/api/employees')
  })

  it('trims the free text filter', async () => {
    const fetchMock = respondWith([])

    await listEmployees({ q: ' max muster ' })

    expect(requestOf(fetchMock).url).toBe('/api/employees?q=max+muster')
  })

  it('sends the full skill state of one employee with PUT', async () => {
    const skills = [
      { skill_id: 's1', proficiency_level: 4 },
      { skill_id: 's2', proficiency_level: 1 },
    ]
    const fetchMock = respondWith({})

    await setSkills('e1', skills)

    expect(requestOf(fetchMock)).toEqual({
      url: '/api/employees/e1/skills',
      method: 'PUT',
      body: { skills },
    })
  })

  it('passes a server error on to the caller', async () => {
    respondWith({ detail: 'boom' }, 500)

    await expect(listEmployees()).rejects.toMatchObject({ status: 500 })
    await expect(listEmployees()).rejects.toBeInstanceOf(HttpError)
  })
})
