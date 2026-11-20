import { type EmployeeFilter } from "../api/models";

/** The employee filter as shown in the filter bar; every part has a defined value. */
export interface ActiveFilter {
  q: string;
  skills: string[];
  skillMatch: "and" | "or";
  minLevel: number | null;
}

/** Typing pause before a name search starts, like the debounce of the Element search bar. */
export const SEARCH_DEBOUNCE_MS = 300;

export const EMPTY_FILTER: ActiveFilter = {
  q: "",
  skills: [],
  skillMatch: "and",
  minLevel: null,
};

export function isFilterActive(filter: ActiveFilter): boolean {
  return (
    filter.q !== "" || filter.skills.length > 0 || filter.minLevel !== null
  );
}

/**
 * Reads the filter from the query string. Values the backend would reject, e.g. a hand-typed
 * min_level=9, are dropped instead of being sent.
 */
export function parseFilter(params: URLSearchParams): ActiveFilter {
  const skills = [
    ...new Set(
      params
        .getAll("skills")
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  ];
  const minLevel = Number(params.get("min_level"));
  return {
    q: (params.get("q") ?? "").trim(),
    skills,
    // AND/OR only means something with at least two terms
    skillMatch:
      params.get("skill_match") === "or" && skills.length > 1 ? "or" : "and",
    minLevel:
      Number.isInteger(minLevel) && minLevel >= 1 && minLevel <= 5
        ? minLevel
        : null,
  };
}

/** Query params for the URL; defaults are left out so an unfiltered view has a clean URL. */
export function filterQueryParams(filter: ActiveFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.q.trim()) {
    params.set("q", filter.q.trim());
  }
  for (const term of filter.skills) {
    params.append("skills", term);
  }
  if (filter.skillMatch === "or" && filter.skills.length > 1) {
    params.set("skill_match", "or");
  }
  if (filter.minLevel !== null) {
    params.set("min_level", `${filter.minLevel}`);
  }
  return params;
}

export function toApiFilter(filter: ActiveFilter): EmployeeFilter {
  return {
    q: filter.q,
    skills: filter.skills,
    skillMatch: filter.skillMatch === "or" ? "or" : undefined,
    minLevel: filter.minLevel ?? undefined,
  };
}

/** A skill term matches the whole name or alias, which is the usual reason for an empty result. */
export function noMatchText(filter: ActiveFilter): string {
  return filter.skills.length
    ? "No employee fits the current filters. Skills match the whole name or alias; add * for a partial match, e.g. kube*."
    : "No employee fits the current filters.";
}

/** Adds a skill term unless it is already part of the search (ignoring case). */
export function withSkill(filter: ActiveFilter, term: string): ActiveFilter {
  const value = term.trim();
  if (
    !value ||
    filter.skills.some(
      (existing) => existing.toLowerCase() === value.toLowerCase(),
    )
  ) {
    return filter;
  }
  return { ...filter, skills: [...filter.skills, value] };
}

/** Removes a skill term; with one term left, AND/OR has no meaning any more. */
export function withoutSkill(filter: ActiveFilter, term: string): ActiveFilter {
  const skills = filter.skills.filter((existing) => existing !== term);
  return {
    ...filter,
    skills,
    skillMatch: skills.length > 1 ? filter.skillMatch : "and",
  };
}
