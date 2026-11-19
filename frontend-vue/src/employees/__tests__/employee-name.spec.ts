import { describe, expect, it } from 'vitest'
import { byLastname, fullName } from '../employee-name'

describe('employee name', () => {
  it('shows the first name first', () => {
    expect(fullName({ firstname: 'Max', lastname: 'Muster' })).toBe('Max Muster')
  })

  it('sorts by last name, then by first name', () => {
    const names = [
      { firstname: 'Max', lastname: 'Schmidt' },
      { firstname: 'Anna', lastname: 'Schmidt' },
      { firstname: 'Zoe', lastname: 'Albers' },
    ]

    const sorted = [...names].sort((a, b) => byLastname(a).localeCompare(byLastname(b)))

    expect(sorted.map(fullName)).toEqual(['Zoe Albers', 'Anna Schmidt', 'Max Schmidt'])
  })

  it('ignores upper and lower case', () => {
    const names = [
      { firstname: 'Ida', lastname: 'Zimmer' },
      { firstname: 'Jan', lastname: 'de Vries' },
    ]

    const sorted = [...names].sort((a, b) => byLastname(a).localeCompare(byLastname(b)))

    expect(sorted.map(fullName)).toEqual(['Jan de Vries', 'Ida Zimmer'])
  })
})
