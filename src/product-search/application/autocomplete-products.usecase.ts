import { Inject, Injectable } from '@nestjs/common';
import { AutocompleteSuggestion } from '../domain/autocomplete-suggestion';
import { PRODUCT_SEARCH_PORT } from './ports/product-search.port';
import type { ProductSearchPort } from './ports/product-search.port';
import { PRODUCT_CACHE_PORT } from './ports/product-cache.port';
import type { ProductCachePort } from './ports/product-cache.port';
import { AUTOCOMPLETE_CACHE_TTL_SECONDS } from './cache-ttl.tokens';

const CACHE_KEY_PREFIX = 'autocomplete:v1:';

/**
 * Mirrors `product_edge_ngram`'s `min_gram: 2` (see
 * `product-index.mapping.ts`): a 1-character prefix can never match
 * anything that was indexed, so it's short-circuited here instead of
 * spending an ES round-trip (or a cache lookup) on a query that's
 * guaranteed to return nothing.
 */
const MIN_PREFIX_LENGTH = 2;

export interface AutocompleteResult {
  suggestions: AutocompleteSuggestion[];
  cached: boolean;
}

@Injectable()
export class AutocompleteProductsUseCase {
  constructor(
    @Inject(PRODUCT_SEARCH_PORT) private readonly searchPort: ProductSearchPort,
    @Inject(PRODUCT_CACHE_PORT) private readonly cachePort: ProductCachePort,
    @Inject(AUTOCOMPLETE_CACHE_TTL_SECONDS)
    private readonly cacheTtlSeconds: number,
  ) {}

  async execute(rawPrefix: string, limit: number): Promise<AutocompleteResult> {
    const prefix = rawPrefix.trim();

    if (prefix.length < MIN_PREFIX_LENGTH) {
      return { suggestions: [], cached: false };
    }

    const cacheKey =
      this.cacheTtlSeconds > 0
        ? `${CACHE_KEY_PREFIX}${prefix.toLowerCase()}:${limit}`
        : null;

    if (cacheKey) {
      const cached =
        await this.cachePort.get<AutocompleteSuggestion[]>(cacheKey);
      if (cached) {
        return { suggestions: cached, cached: true };
      }
    }

    const suggestions = await this.searchPort.autocomplete(prefix, limit);

    if (cacheKey) {
      await this.cachePort.set(cacheKey, suggestions, this.cacheTtlSeconds);
    }

    return { suggestions, cached: false };
  }
}
