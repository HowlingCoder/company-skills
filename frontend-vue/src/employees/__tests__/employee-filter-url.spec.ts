import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTER,
  filterQueryParams,
  isFilterActive,
  parseFilter,
  withoutSkill,
  withSkill,
} from '../employee-filter-url'

const parse = (query: string) => parseFilter(new URLSearchParams(query))

describe('employee filter URL', () => {
  it('reads an empty URL as no filter', () => {
    expect(parse('')).toEqual(EMPTY_FILTER)
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
  })

  it('reads all four filters', () => {
    const filter = parse('q=mus&skills=python&skills=k8s&skill_match=or&min_level=3')

    expect(filter).toEqual({ q: 'mus', skills: ['python', 'k8s'], skillMatch: 'or', minLevel: 3 })
    expect(isFilterActive(filter)).toBe(true)
  })

  it.each(['0', '6', '2.5', 'abc', ''])('drops the invalid min_level "%s"', (value) => {
    expect(parse(`min_level=${value}`).minLevel).toBeNull()
  })

  it('drops blank and repeated skill terms', () => {
    expect(parse('skills=%20python%20&skills=&skills=python&skills=%20%20').skills).toEqual([
      'python',
    ])
  })

  it('falls back to AND for one skill or an unknown skill_match', () => {
    expect(parse('skills=python&skill_match=or').skillMatch).toBe('and')
    expect(parse('skills=a&skills=b&skill_match=xor').skillMatch).toBe('and')
  })

  it('leaves defaults out of the URL', () => {
    expect(filterQueryParams(EMPTY_FILTER).toString()).toBe('')
    expect(
      filterQueryParams({
        q: ' max ',
        skills: ['a', 'b'],
        skillMatch: 'and',
        minLevel: null,
      }).toString(),
    ).toBe('q=max&skills=a&skills=b')
  })

  it('writes every active filter and survives a round trip', () => {
    const filter = { q: 'mus', skills: ['python', 'c*'], skillMatch: 'or' as const, minLevel: 4 }

    const params = filterQueryParams(filter)

    expect(params.toString()).toBe('q=mus&skills=python&skills=c*&skill_match=or&min_level=4')
    expect(parseFilter(params)).toEqual(filter)
  })
})

describe('skill terms', () => {
  it('adds a trimmed term once, ignoring case', () => {
    const filter = withSkill(EMPTY_FILTER, ' Python ')

    expect(filter.skills).toEqual(['Python'])
    expect(withSkill(filter, 'python')).toBe(filter)
    expect(withSkill(filter, '  ')).toBe(filter)
  })

  it('falls back to AND when only one term is left', () => {
    const filter = { ...EMPTY_FILTER, skills: ['a', 'b'], skillMatch: 'or' as const }

    expect(withoutSkill(filter, 'a')).toEqual({ ...EMPTY_FILTER, skills: ['b'] })
  })
})
