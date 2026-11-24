import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { listEmployees } from "../api/employee-api";
import { WAKE_UP_RETRY_MS, shouldRetryWakeUp } from "../api/wake-up";
import { type ActiveFilter, toApiFilter } from "./employee-filter-url";

/** Query key prefix of every employee list; invalidate it after a change to reload the table. */
export const EMPLOYEES_KEY = ["employees"] as const;

/** The employees matching the filter, loaded from the server and cached per filter. */
export function useEmployees(filter: ActiveFilter) {
  const queryClient = useQueryClient();
  // Only the first load waits for a sleeping backend; once any list arrived, errors show at once
  const firstLoad = () =>
    queryClient
      .getQueryCache()
      .findAll({ queryKey: EMPLOYEES_KEY })
      .every((query) => query.state.data === undefined);

  return useQuery({
    queryKey: [...EMPLOYEES_KEY, filter],
    queryFn: () => listEmployees(toApiFilter(filter)),
    // keeps the old rows on screen while a search runs, instead of the spinner
    placeholderData: keepPreviousData,
    retry: (failureCount, error) =>
      firstLoad() && shouldRetryWakeUp(failureCount, error),
    retryDelay: WAKE_UP_RETRY_MS,
  });
}
