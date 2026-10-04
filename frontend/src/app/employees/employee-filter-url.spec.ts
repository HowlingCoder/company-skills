import { convertToParamMap } from '@angular/router';
import {
  EMPTY_FILTER,
  filterQueryParams,
  isFilterActive,
  parseFilter,
} from './employee-filter-url';

describe('employee filter URL', () => {
  it('reads an empty URL as no filter', () => {
    expect(parseFilter(convertToParamMap({}))).toEqual(EMPTY_FILTER);
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
  });

  it('reads all four filters', () => {
    const filter = parseFilter(
      convertToParamMap({ q: 'mus', skills: ['python', 'k8s'], skill_match: 'or', min_level: '3' }),
    );

    expect(filter).toEqual({ q: 'mus', skills: ['python', 'k8s'], skillMatch: 'or', minLevel: 3 });
    expect(isFilterActive(filter)).toBe(true);
  });

  it.each(['0', '6', '2.5', 'abc', ''])('drops the invalid min_level "%s"', (value) => {
    expect(parseFilter(convertToParamMap({ min_level: value })).minLevel).toBeNull();
  });

  it('drops blank and repeated skill terms', () => {
    const filter = parseFilter(convertToParamMap({ skills: [' python ', '', 'python', '  '] }));

    expect(filter.skills).toEqual(['python']);
  });

  it('falls back to AND for one skill or an unknown skill_match', () => {
    expect(
      parseFilter(convertToParamMap({ skills: ['python'], skill_match: 'or' })).skillMatch,
    ).toBe('and');
    expect(
      parseFilter(convertToParamMap({ skills: ['a', 'b'], skill_match: 'xor' })).skillMatch,
    ).toBe('and');
  });

  it('leaves defaults out of the URL', () => {
    expect(filterQueryParams(EMPTY_FILTER)).toEqual({});
    expect(
      filterQueryParams({ q: ' max ', skills: ['a', 'b'], skillMatch: 'and', minLevel: null }),
    ).toEqual({ q: 'max', skills: ['a', 'b'] });
  });

  it('writes every active filter and survives a round trip', () => {
    const filter = { q: 'mus', skills: ['python', 'c*'], skillMatch: 'or' as const, minLevel: 4 };

    const params = filterQueryParams(filter);

    expect(params).toEqual({ q: 'mus', skills: ['python', 'c*'], skill_match: 'or', min_level: 4 });
    expect(parseFilter(convertToParamMap(params))).toEqual(filter);
  });
});
