import { AutocompleteProductsUseCase } from './autocomplete-products.usecase';
import type { ProductSearchPort } from './ports/product-search.port';
import type { ProductCachePort } from './ports/product-cache.port';
import { AutocompleteSuggestion } from '../domain/autocomplete-suggestion';

const SUGGESTIONS: AutocompleteSuggestion[] = [
  { text: 'Laptop Dell XPS 13', productId: 'laptop-dell-xps-13' },
];

interface FakeSearchPort {
  port: ProductSearchPort;
  autocomplete: jest.Mock;
}

// Mocks are returned as standalone variables (not read back off `port`) so
// `expect(autocomplete).toHaveBeenCalled()` doesn't trip
// @typescript-eslint/unbound-method, which flags `expect(port.autocomplete)`
// as an unbound method reference even though jest never calls it unbound.
function fakeSearchPort(suggestions: AutocompleteSuggestion[]): FakeSearchPort {
  const search = jest.fn();
  const autocomplete = jest.fn().mockResolvedValue(suggestions);
  return { port: { search, autocomplete }, autocomplete };
}

interface FakeCachePort {
  port: ProductCachePort;
  get: jest.Mock;
  set: jest.Mock;
}

function fakeCachePort(initial: unknown = null): FakeCachePort {
  let stored = initial;
  const get = jest.fn().mockImplementation(() => Promise.resolve(stored));
  const set = jest.fn().mockImplementation((_key: string, value: unknown) => {
    stored = value;
    return Promise.resolve();
  });
  return { port: { get, set }, get, set };
}

describe('AutocompleteProductsUseCase', () => {
  it('short-circuits prefixes shorter than 2 characters without touching the search or cache ports', async () => {
    const { port: searchPort, autocomplete } = fakeSearchPort(SUGGESTIONS);
    const { port: cachePort, get } = fakeCachePort();
    const useCase = new AutocompleteProductsUseCase(searchPort, cachePort, 300);

    const result = await useCase.execute('l', 10);

    expect(result).toEqual({ suggestions: [], cached: false });
    expect(autocomplete).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('queries the search port and populates the cache on a miss', async () => {
    const { port: searchPort, autocomplete } = fakeSearchPort(SUGGESTIONS);
    const { port: cachePort, set } = fakeCachePort();
    const useCase = new AutocompleteProductsUseCase(searchPort, cachePort, 300);

    const result = await useCase.execute('lap', 10);

    expect(result).toEqual({ suggestions: SUGGESTIONS, cached: false });
    expect(autocomplete).toHaveBeenCalledWith('lap', 10);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('returns the cached suggestions and skips the search port on a hit', async () => {
    const { port: searchPort, autocomplete } = fakeSearchPort([]);
    const { port: cachePort } = fakeCachePort(SUGGESTIONS);
    const useCase = new AutocompleteProductsUseCase(searchPort, cachePort, 300);

    const result = await useCase.execute('lap', 10);

    expect(result).toEqual({ suggestions: SUGGESTIONS, cached: true });
    expect(autocomplete).not.toHaveBeenCalled();
  });

  it('bypasses the cache entirely when cacheTtlSeconds is 0', async () => {
    const { port: searchPort } = fakeSearchPort(SUGGESTIONS);
    const { port: cachePort, get, set } = fakeCachePort();
    const useCase = new AutocompleteProductsUseCase(searchPort, cachePort, 0);

    const result = await useCase.execute('lap', 10);

    expect(result).toEqual({ suggestions: SUGGESTIONS, cached: false });
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('trims the prefix before checking its length and before querying', async () => {
    const { port: searchPort, autocomplete } = fakeSearchPort(SUGGESTIONS);
    const { port: cachePort } = fakeCachePort();
    const useCase = new AutocompleteProductsUseCase(searchPort, cachePort, 300);

    await useCase.execute('  lap  ', 10);

    expect(autocomplete).toHaveBeenCalledWith('lap', 10);
  });
});
