import { afterEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { EMPTY_FILTER } from '../employee-filter-url'
import { useUrlFilter } from '../useUrlFilter'

function withUrl(query: string) {
  window.history.replaceState(null, '', `/${query}`)
  const scope = effectScope()
  const filter = scope.run(() => useUrlFilter())!
  return { filter, stop: () => scope.stop() }
}

describe('useUrlFilter', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('reads the filter from the URL', () => {
    const { filter, stop } = withUrl('?q=mus&min_level=2')

    expect(filter.value).toEqual({ ...EMPTY_FILTER, q: 'mus', minLevel: 2 })
    stop()
  })

  it('writes a new filter to the URL without a history entry', () => {
    const { filter, stop } = withUrl('')
    const entries = window.history.length

    filter.value = { ...EMPTY_FILTER, skills: ['python', 'go'], skillMatch: 'or' }

    expect(window.location.search).toBe('?skills=python&skills=go&skill_match=or')
    expect(window.history.length).toBe(entries)
    expect(filter.value.skills).toEqual(['python', 'go'])
    stop()
  })

  it('leaves a clean URL for the empty filter', () => {
    const { filter, stop } = withUrl('?q=max')

    filter.value = EMPTY_FILTER

    expect(window.location.search).toBe('')
    stop()
  })

  it('follows the URL on back and forward', () => {
    const { filter, stop } = withUrl('')

    window.history.replaceState(null, '', '/?q=anna')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(filter.value.q).toBe('anna')
    stop()
  })
})
