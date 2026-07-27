/**
 * DI tokens for the cache TTLs (in seconds) used by the use cases below.
 * Plain numbers aren't injectable by class, so they need their own tokens;
 * bound in `ProductSearchModule` from `SEARCH_CACHE_TTL_SECONDS` /
 * `AUTOCOMPLETE_CACHE_TTL_SECONDS` env vars. A value of `0` disables
 * caching for that use case entirely — see `SearchProductsUseCase` /
 * `AutocompleteProductsUseCase`.
 */
export const SEARCH_CACHE_TTL_SECONDS = Symbol('SEARCH_CACHE_TTL_SECONDS');
export const AUTOCOMPLETE_CACHE_TTL_SECONDS = Symbol(
  'AUTOCOMPLETE_CACHE_TTL_SECONDS',
);
