import { useEffect, useState } from "react";
import {
  type ActiveFilter,
  filterQueryParams,
  parseFilter,
} from "./employee-filter-url";

/** The filter as the query string of the current URL describes it. */
export function readUrlFilter(): ActiveFilter {
  return parseFilter(new URLSearchParams(window.location.search));
}

/** Writes the filter to the URL; replace, not push, so typing does not fill the back button history. */
export function writeUrlFilter(filter: ActiveFilter): void {
  const query = filterQueryParams(filter).toString();
  window.history.replaceState(
    window.history.state,
    "",
    query ? `?${query}` : window.location.pathname,
  );
}

/** The employee filter, kept in the query string so it survives a reload and can be shared. */
export function useUrlFilter(): [ActiveFilter, (filter: ActiveFilter) => void] {
  const [filter, setFilterState] = useState(readUrlFilter);

  // back/forward change the URL without React noticing
  useEffect(() => {
    const onPopState = () => setFilterState(readUrlFilter());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setFilter = (next: ActiveFilter) => {
    writeUrlFilter(next);
    // read back what the URL holds (e.g. trimmed text), so state and URL never disagree
    setFilterState(readUrlFilter());
  };

  return [filter, setFilter];
}
