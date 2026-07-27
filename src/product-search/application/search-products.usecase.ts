import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SearchCriteria } from '../domain/search-criteria';
import { SearchResult } from '../domain/search-result';
import { PRODUCT_SEARCH_PORT } from './ports/product-search.port';
import type { ProductSearchPort } from './ports/product-search.port';
import { PRODUCT_CACHE_PORT } from './ports/product-cache.port';
import type { ProductCachePort } from './ports/product-cache.port';
import { SEARCH_CACHE_TTL_SECONDS } from './cache-ttl.tokens';

const CACHE_KEY_PREFIX = 'search:v1:';

/**
 * Cache-aside search: a cache hit skips Elasticsearch entirely; a miss
 * queries it and populates the cache for next time. `cacheTtlSeconds: 0`
 * disables caching altogether (used by e2e tests, which need deterministic
 * results uncontaminated by a previous test's cached response).
 */
@Injectable()
export class SearchProductsUseCase {
  constructor(
    @Inject(PRODUCT_SEARCH_PORT) private readonly searchPort: ProductSearchPort,
    @Inject(PRODUCT_CACHE_PORT) private readonly cachePort: ProductCachePort,
    @Inject(SEARCH_CACHE_TTL_SECONDS) private readonly cacheTtlSeconds: number,
  ) {}

  async execute(criteria: SearchCriteria): Promise<SearchResult> {
    const cacheKey =
      this.cacheTtlSeconds > 0 ? this.buildCacheKey(criteria) : null;

    if (cacheKey) {
      const cached = await this.cachePort.get<SearchResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await this.searchPort.search(criteria);

    if (cacheKey) {
      await this.cachePort.set(cacheKey, result, this.cacheTtlSeconds);
    }

    return result;
  }

  /**
   * Deterministic key over the criteria that actually affect the result.
   * The `v1` prefix lets a future mapping/scoring change invalidate every
   * cached search at once just by bumping it.
   */
  private buildCacheKey(criteria: SearchCriteria): string {
    const normalized = {
      query: criteria.query,
      categories: [...criteria.filters.categories].sort(),
      subcategories: [...criteria.filters.subcategories].sort(),
      locations: [...criteria.filters.locations].sort(),
      price: criteria.filters.price
        ? { min: criteria.filters.price.min, max: criteria.filters.price.max }
        : null,
      sort: { field: criteria.sort.field, order: criteria.sort.order },
      page: criteria.pagination.page,
      limit: criteria.pagination.limit,
    };
    const hash = createHash('sha1')
      .update(JSON.stringify(normalized))
      .digest('hex');
    return `${CACHE_KEY_PREFIX}${hash}`;
  }
}
