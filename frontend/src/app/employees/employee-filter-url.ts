import { ParamMap, Params } from '@angular/router';
import { EmployeeFilter } from '../api/models';

/** The employee filter as shown in the filter bar; every part has a defined value. */
export interface ActiveFilter {
  q: string;
  skills: string[];
  skillMatch: 'and' | 'or';
  minLevel: number | null;
}

export const EMPTY_FILTER: ActiveFilter = { q: '', skills: [], skillMatch: 'and', minLevel: null };

export function isFilterActive(filter: ActiveFilter): boolean {
  return filter.q !== '' || filter.skills.length > 0 || filter.minLevel !== null;
}

/**
 * Reads the filter from the query params. Values the backend would reject, e.g. a hand-typed
 * min_level=9, are dropped instead of being sent.
 */
export function parseFilter(params: ParamMap): ActiveFilter {
  const skills = [
    ...new Set(
      params
        .getAll('skills')
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  ];
  const minLevel = Number(params.get('min_level'));
  return {
    q: (params.get('q') ?? '').trim(),
    skills,
    // AND/OR only means something with at least two terms
    skillMatch: params.get('skill_match') === 'or' && skills.length > 1 ? 'or' : 'and',
    minLevel: Number.isInteger(minLevel) && minLevel >= 1 && minLevel <= 5 ? minLevel : null,
  };
}

/** Query params for the URL; defaults are left out so an unfiltered view has a clean URL. */
export function filterQueryParams(filter: ActiveFilter): Params {
  const params: Params = {};
  if (filter.q.trim()) {
    params['q'] = filter.q.trim();
  }
  if (filter.skills.length) {
    params['skills'] = filter.skills;
  }
  if (filter.skillMatch === 'or' && filter.skills.length > 1) {
    params['skill_match'] = 'or';
  }
  if (filter.minLevel !== null) {
    params['min_level'] = filter.minLevel;
  }
  return params;
}

export function toApiFilter(filter: ActiveFilter): EmployeeFilter {
  return {
    q: filter.q,
    skills: filter.skills,
    skillMatch: filter.skillMatch === 'or' ? 'or' : undefined,
    minLevel: filter.minLevel ?? undefined,
  };
}
