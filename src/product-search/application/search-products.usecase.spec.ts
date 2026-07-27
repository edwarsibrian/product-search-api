import { SearchProductsUseCase } from './search-products.usecase';
import type { ProductSearchPort } from './ports/product-search.port';
import type { ProductCachePort } from './ports/product-cache.port';
import { SearchCriteria } from '../domain/search-criteria';
import { SearchResult } from '../domain/search-result';
import { Pagination } from '../domain/value-objects/pagination.vo';
import { SortCriteria } from '../domain/value-objects/sort-criteria.vo';

function criteria(): SearchCriteria {
  return {
    query: 'laptop',
    filters: { categories: [], subcategories: [], locations: [], price: null },
    sort: SortCriteria.create('relevance', 'desc'),
    pagination: Pagination.create(1, 20),
  };
}

function result(): SearchResult {
  return {
    items: [],
    total: 0,
    facets: {
      categories: [],
      subcategories: [],
      locations: [],
      price: { min: null, max: null, avg: null },
    },
    suggestions: { didYouMean: [], related: [] },
  };
}

interface FakeSearchPort {
  port: ProductSearchPort;
  search: jest.Mock;
}

// Mocks are returned as standalone variables (not read back off `port`) so
// `expect(search).toHaveBeenCalled()` doesn't trip
// @typescript-eslint/unbound-method, which flags `expect(port.search)` as
// an unbound method reference even though jest never calls it unbound.
function fakeSearchPort(searchResult: SearchResult): FakeSearchPort {
  const search = jest.fn().mockResolvedValue(searchResult);
  const autocomplete = jest.fn().mockResolvedValue([]);
  return { port: { search, autocomplete }, search };
}

interface FakeCachePort {
  port: ProductCachePort;
  get: jest.Mock;
  set: jest.Mock;
}

function fakeCachePort(initial: SearchResult | null = null): FakeCachePort {
  let stored: unknown = initial;
  const get = jest.fn().mockImplementation(() => Promise.resolve(stored));
  const set = jest.fn().mockImplementation((_key: string, value: unknown) => {
    stored = value;
    return Promise.resolve();
  });
  return { port: { get, set }, get, set };
}

describe('SearchProductsUseCase', () => {
  it('queries the search port and populates the cache on a miss', async () => {
    const expected = result();
    const { port: searchPort, search } = fakeSearchPort(expected);
    const { port: cachePort, set } = fakeCachePort();
    const useCase = new SearchProductsUseCase(searchPort, cachePort, 60);

    const actual = await useCase.execute(criteria());

    expect(actual).toBe(expected);
    expect(search).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('returns the cached result and skips the search port on a hit', async () => {
    const cached = result();
    const { port: searchPort, search } = fakeSearchPort(result());
    const { port: cachePort } = fakeCachePort(cached);
    const useCase = new SearchProductsUseCase(searchPort, cachePort, 60);

    const actual = await useCase.execute(criteria());

    expect(actual).toBe(cached);
    expect(search).not.toHaveBeenCalled();
  });

  it('bypasses the cache entirely when cacheTtlSeconds is 0', async () => {
    const { port: searchPort, search } = fakeSearchPort(result());
    const { port: cachePort, get, set } = fakeCachePort(result());
    const useCase = new SearchProductsUseCase(searchPort, cachePort, 0);

    await useCase.execute(criteria());

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('produces the same cache key for equivalent criteria regardless of filter array order', async () => {
    const { port: cachePort } = fakeCachePort();
    const { port: searchPort, search } = fakeSearchPort(result());
    const useCase = new SearchProductsUseCase(searchPort, cachePort, 60);

    const criteriaA: SearchCriteria = {
      ...criteria(),
      filters: {
        categories: ['A', 'B'],
        subcategories: [],
        locations: [],
        price: null,
      },
    };
    const criteriaB: SearchCriteria = {
      ...criteria(),
      filters: {
        categories: ['B', 'A'],
        subcategories: [],
        locations: [],
        price: null,
      },
    };

    await useCase.execute(criteriaA);
    await useCase.execute(criteriaB);

    // second call was a cache hit for the same normalized criteria — the
    // search port should only have been queried once.
    expect(search).toHaveBeenCalledTimes(1);
  });
});
