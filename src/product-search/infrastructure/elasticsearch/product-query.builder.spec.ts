import type { estypes } from '@elastic/elasticsearch';
import {
  buildAutocompleteQuery,
  buildSearchQuery,
} from './product-query.builder';
import { SearchCriteria } from '../../domain/search-criteria';
import { PriceRange } from '../../domain/value-objects/price-range.vo';
import { Pagination } from '../../domain/value-objects/pagination.vo';
import {
  SortCriteria,
  SortField,
  SortOrder,
} from '../../domain/value-objects/sort-criteria.vo';

interface CriteriaOverrides {
  query?: string | null;
  categories?: string[];
  subcategories?: string[];
  locations?: string[];
  price?: PriceRange | null;
  sortField?: SortField;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

function criteria(overrides: CriteriaOverrides = {}): SearchCriteria {
  return {
    query: overrides.query ?? null,
    filters: {
      categories: overrides.categories ?? [],
      subcategories: overrides.subcategories ?? [],
      locations: overrides.locations ?? [],
      price: overrides.price ?? null,
    },
    sort: SortCriteria.create(
      overrides.sortField ?? 'relevance',
      overrides.sortOrder ?? 'desc',
    ),
    pagination: Pagination.create(overrides.page ?? 1, overrides.limit ?? 20),
  };
}

function boolFilter(
  clause: estypes.QueryDslQueryContainer | undefined,
): estypes.QueryDslQueryContainer[] {
  return (clause?.bool as estypes.QueryDslBoolQuery)
    .filter as estypes.QueryDslQueryContainer[];
}

/**
 * Elasticsearch's `estypes.QueryDslQueryContainer` is a huge `ExactlyOne`
 * union (one branch per query type), which makes TS treat indexed access
 * into an array of it as possibly `undefined` even without
 * `noUncheckedIndexedAccess`. A runtime-checked accessor sidesteps that
 * without resorting to non-null assertions.
 */
function nth<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(
      `Expected an item at index ${index}, but the array has ${items.length}`,
    );
  }
  return item;
}

/**
 * `QueryDslQueryContainer`'s `ExactlyOne` branches keep each key's original
 * (optional) value type, so reading e.g. `.multi_match` directly off the
 * union still resolves as possibly `undefined` even on the branch where
 * it's the active key. Casting the container to a concrete single-key shape
 * first sidesteps that instead of reading through the union.
 */
function asMultiMatch(
  clause: estypes.QueryDslQueryContainer,
): estypes.QueryDslMultiMatchQuery {
  return (clause as { multi_match: estypes.QueryDslMultiMatchQuery })
    .multi_match;
}

function asTerms(
  clause: estypes.QueryDslQueryContainer,
): estypes.QueryDslTermsQuery {
  return (clause as { terms: estypes.QueryDslTermsQuery }).terms;
}

function asRange(
  clause: estypes.QueryDslQueryContainer,
): Record<string, estypes.QueryDslRangeQueryBase<number>> {
  return (
    clause as { range: Record<string, estypes.QueryDslRangeQueryBase<number>> }
  ).range;
}

describe('buildSearchQuery', () => {
  it('requests accurate totals and the full set of source fields', () => {
    const body = buildSearchQuery(criteria());
    expect(body.track_total_hits).toBe(true);
    expect(body._source).toEqual([
      'id',
      'name',
      'description',
      'category',
      'subcategories',
      'location',
      'price',
      'popularity',
      'created_at',
    ]);
  });

  it('translates page/limit into Elasticsearch from/size', () => {
    const body = buildSearchQuery(criteria({ page: 3, limit: 10 }));
    expect(body.from).toBe(20);
    expect(body.size).toBe(10);
  });

  describe('text query', () => {
    it('matches everything and skips post_filter/suggest when there is no query or filters', () => {
      const body = buildSearchQuery(criteria());
      expect(body.query).toEqual({ match_all: {} });
      expect(body.post_filter).toBeUndefined();
      expect(body.suggest).toBeUndefined();
    });

    it('builds a precise clause and a separate fuzzy clause, never fuzzy on the ngram-indexed name field', () => {
      const body = buildSearchQuery(criteria({ query: 'lapto' }));
      const bool = body.query?.bool as estypes.QueryDslBoolQuery;
      const should = bool.should as estypes.QueryDslQueryContainer[];
      expect(should).toHaveLength(2);

      const precise = asMultiMatch(nth(should, 0));
      expect(precise.fuzziness).toBeUndefined();
      expect(precise.fields).toEqual([
        'name^3',
        'name.trigram^2',
        'description',
      ]);

      const fuzzy = asMultiMatch(nth(should, 1));
      expect(fuzzy.fuzziness).toBe('AUTO');
      expect(fuzzy.fields).toEqual(['name.trigram^1.5', 'description^0.5']);
      expect(fuzzy.fields).not.toContain('name');
      expect(fuzzy.fields).not.toContain('name^3');
    });
  });

  describe('filters', () => {
    it('filters by category through the normalized sub-field', () => {
      const body = buildSearchQuery(criteria({ categories: ['Electrónica'] }));
      const filter = boolFilter(body.post_filter);
      expect(filter).toHaveLength(1);
      expect(asTerms(nth(filter, 0))).toEqual({
        'category.normalized': ['electronica'],
      });
    });

    it('filters by subcategory through the normalized sub-field', () => {
      const body = buildSearchQuery(
        criteria({ subcategories: ['Portátiles'] }),
      );
      const filter = boolFilter(body.post_filter);
      expect(asTerms(nth(filter, 0))).toEqual({
        'subcategories.normalized': ['portatiles'],
      });
    });

    it('filters by location through the normalized sub-field', () => {
      const body = buildSearchQuery(criteria({ locations: ['Madrid'] }));
      const filter = boolFilter(body.post_filter);
      expect(asTerms(nth(filter, 0))).toEqual({
        'location.normalized': ['madrid'],
      });
    });

    it('filters by a full price range', () => {
      const body = buildSearchQuery(
        criteria({ price: PriceRange.create(10, 100) }),
      );
      const filter = boolFilter(body.post_filter);
      expect(asRange(nth(filter, 0))).toEqual({ price: { gte: 10, lte: 100 } });
    });

    it('filters by an open-ended minimum price', () => {
      const body = buildSearchQuery(criteria({ price: PriceRange.create(10) }));
      const filter = boolFilter(body.post_filter);
      expect(asRange(nth(filter, 0))).toEqual({ price: { gte: 10 } });
    });

    it('combines multiple active filters with AND semantics in post_filter', () => {
      const body = buildSearchQuery(
        criteria({
          categories: ['Moda'],
          locations: ['Madrid'],
          price: PriceRange.create(0, 50),
        }),
      );
      expect(boolFilter(body.post_filter)).toHaveLength(3);
    });
  });

  describe('facet aggregations (multi-select faceting)', () => {
    it("excludes only a facet's own filter from its aggregation, keeping the others", () => {
      const body = buildSearchQuery(
        criteria({
          categories: ['Electrónica'],
          price: PriceRange.create(500),
        }),
      );
      const aggs = body.aggs as Record<
        string,
        estypes.AggregationsAggregationContainer
      >;

      // categories agg excludes the category filter, but keeps the price filter.
      const categoriesFilter = boolFilter(aggs.categories.filter);
      expect(categoriesFilter).toHaveLength(1);
      expect(asRange(nth(categoriesFilter, 0))).toEqual({
        price: { gte: 500 },
      });

      // price agg excludes the price filter, but keeps the category filter.
      const priceFilter = boolFilter(aggs.price.filter);
      expect(priceFilter).toHaveLength(1);
      expect(asTerms(nth(priceFilter, 0))).toEqual({
        'category.normalized': ['electronica'],
      });

      // locations agg isn't affected by either active filter, so it keeps both.
      const locationsFilter = boolFilter(aggs.locations.filter);
      expect(locationsFilter).toHaveLength(2);
    });

    it('falls back to match_all for a facet when no other filters are active', () => {
      const body = buildSearchQuery(criteria({ categories: ['Moda'] }));
      const aggs = body.aggs as Record<
        string,
        estypes.AggregationsAggregationContainer
      >;
      expect(aggs.categories.filter).toEqual({ match_all: {} });
    });

    it('aggregates by the parent keyword field (not .normalized), so buckets keep their original casing', () => {
      const body = buildSearchQuery(criteria());
      const aggs = body.aggs as Record<
        string,
        estypes.AggregationsAggregationContainer
      >;
      const categoriesTerms = (
        aggs.categories.aggs as Record<
          string,
          estypes.AggregationsAggregationContainer
        >
      ).values.terms as estypes.AggregationsTermsAggregation;
      expect(categoriesTerms.field).toBe('category');
    });

    it('scopes the related-terms aggregation to every active filter', () => {
      const body = buildSearchQuery(
        criteria({ categories: ['Electrónica'], locations: ['Madrid'] }),
      );
      const aggs = body.aggs as Record<
        string,
        estypes.AggregationsAggregationContainer
      >;
      expect(boolFilter(aggs.related.filter)).toHaveLength(2);
    });
  });

  describe('did-you-mean suggest', () => {
    it('builds a phrase suggester over name.trigram when there is a query', () => {
      const body = buildSearchQuery(criteria({ query: 'lapto' }));
      const suggest = body.suggest as estypes.SearchSuggester;
      const didYouMean = suggest.did_you_mean as estypes.SearchFieldSuggester;
      expect(didYouMean.text).toBe('lapto');
      const phrase = didYouMean.phrase as estypes.SearchPhraseSuggester;
      expect(phrase.field).toBe('name.trigram');
    });

    it('omits suggest entirely when there is no query', () => {
      const body = buildSearchQuery(criteria());
      expect(body.suggest).toBeUndefined();
    });
  });

  describe('sort', () => {
    it('sorts by relevance with popularity/id tie-breakers when there is a query', () => {
      const body = buildSearchQuery(criteria({ query: 'laptop' }));
      expect(body.sort).toEqual([
        { _score: { order: 'desc' } },
        { popularity: 'desc' },
        { id: 'asc' },
      ]);
    });

    it('degrades relevance sort to popularity when there is no query', () => {
      const body = buildSearchQuery(criteria({ sortField: 'relevance' }));
      expect(body.sort).toEqual([{ popularity: 'desc' }, { id: 'asc' }]);
    });

    it('sorts by popularity with a stable id tie-breaker', () => {
      const body = buildSearchQuery(
        criteria({ sortField: 'popularity', sortOrder: 'asc' }),
      );
      expect(body.sort).toEqual([{ popularity: 'asc' }, { id: 'asc' }]);
    });

    it('sorts by createdAt (mapped to the created_at ES field) with a stable id tie-breaker', () => {
      const body = buildSearchQuery(
        criteria({ sortField: 'createdAt', sortOrder: 'desc' }),
      );
      expect(body.sort).toEqual([{ created_at: 'desc' }, { id: 'asc' }]);
    });
  });
});

describe('buildAutocompleteQuery', () => {
  it('matches on name — the search_analyzer strips n-grams, so this is a prefix match by construction', () => {
    const body = buildAutocompleteQuery('lap', 5);
    expect(body.query).toEqual({ match: { name: 'lap' } });
    expect(body.size).toBe(5);
    expect(body._source).toEqual(['id', 'name']);
  });

  it('sorts by score, then popularity, then id', () => {
    const body = buildAutocompleteQuery('lap', 5);
    expect(body.sort).toEqual([
      { _score: { order: 'desc' } },
      { popularity: 'desc' },
      { id: 'asc' },
    ]);
  });
});
