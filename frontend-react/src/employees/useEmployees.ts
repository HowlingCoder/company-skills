import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listEmployees } from "../api/employee-api";
import { type ActiveFilter, toApiFilter } from "./employee-filter-url";

/** Query key prefix of every employee list; invalidate it after a change to reload the table. */
export const EMPLOYEES_KEY = ["employees"] as const;

/** The employees matching the filter, loaded from the server and cached per filter. */
export function useEmployees(filter: ActiveFilter) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, filter],
    queryFn: () => listEmployees(toApiFilter(filter)),
    // keeps the old rows on screen while a search runs, instead of the spinner
    placeholderData: keepPreviousData,
  });
}
