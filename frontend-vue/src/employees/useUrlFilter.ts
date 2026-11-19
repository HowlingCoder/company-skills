import { computed, onScopeDispose, ref } from 'vue'
import { type ActiveFilter, filterQueryParams, parseFilter } from './employee-filter-url'

function readUrl(): ActiveFilter {
  return parseFilter(new URLSearchParams(window.location.search))
}

/** The employee filter, kept in the query string so it survives a reload and can be shared. */
export function useUrlFilter() {
  const current = ref<ActiveFilter>(readUrl())

  // back/forward buttons, if another script pushed a history entry
  const onPopState = () => (current.value = readUrl())
  window.addEventListener('popstate', onPopState)
  onScopeDispose(() => window.removeEventListener('popstate', onPopState))

  return computed<ActiveFilter>({
    get: () => current.value,
    set: (filter) => {
      const query = filterQueryParams(filter).toString()
      // replace, not push: typing a search should not fill the back button history
      window.history.replaceState(
        window.history.state,
        '',
        query ? `?${query}` : window.location.pathname,
      )
      current.value = readUrl()
    },
  })
}
