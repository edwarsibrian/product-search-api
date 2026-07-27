import type { estypes } from '@elastic/elasticsearch';
import { SearchCriteria } from '../../domain/search-criteria';
import { normalizeKeyword } from './keyword-normalizer';

/**
 * The parts of `estypes.SearchRequest` this builder actually produces.
 * `index` is intentionally excluded — the repository adds it, since the
 * builder is pure and doesn't know (or need to know) which index it's for.
 */
export type ProductSearchRequestBody = Pick<
  estypes.SearchRequest,
  | 'query'
  | 'post_filter'
  | 'aggs'
  | 'suggest'
  | 'sort'
  | 'from'
  | 'size'
  | 'track_total_hits'
  | '_source'
>;

export interface ProductAutocompleteRequestBody {
  query: estypes.QueryDslQueryContainer;
  sort: estypes.SearchRequest['sort'];
  size: number;
  _source: string[];
}

const SOURCE_FIELDS = [
  'id',
  'name',
  'description',
  'category',
  'subcategories',
  'location',
  'price',
  'popularity',
  'created_at',
] as const;

const FACET_SIZE = {
  categories: 20,
  subcategories: 30,
  locations: 20,
} as const;
const RELATED_TERMS_SIZE = 5;
const DID_YOU_MEAN_SIZE = 3;

/**
 * Two `multi_match` clauses combined with `should` (OR, best score wins):
 * a precise one (no fuzziness) and a typo-tolerant one. Fuzziness is
 * deliberately kept OFF `name` itself — `name` is indexed with edge
 * n-grams (see `product-index.mapping.ts`), and `fuzziness` on top of that
 * would multiply the over-matching the search analyzer split was designed
 * to avoid (`"mesa"~1` would fuzzy-match `me`/`mes` prefixes too). Fuzzy
 * matching instead runs against `name.trigram` (full tokens, no n-grams)
 * and `description`.
 */
function buildTextQuery(query: string | null): estypes.QueryDslQueryContainer {
  if (!query) {
    return { match_all: {} };
  }

  return {
    bool: {
      should: [
        {
          multi_match: {
            query,
            type: 'best_fields',
            fields: ['name^3', 'name.trigram^2', 'description'],
            minimum_should_match: '2<75%',
          },
        },
        {
          multi_match: {
            query,
            type: 'best_fields',
            fields: ['name.trigram^1.5', 'description^0.5'],
            fuzziness: 'AUTO',
            prefix_length: 1,
            minimum_should_match: '2<75%',
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}

/**
 * One optional filter clause per facet, keyed by name so each facet's
 * aggregation can exclude exactly its own clause (see `clausesExcept`)
 * without depending on array positions.
 */
interface NamedFilterClauses {
  categories?: estypes.QueryDslQueryContainer;
  subcategories?: estypes.QueryDslQueryContainer;
  locations?: estypes.QueryDslQueryContainer;
  price?: estypes.QueryDslQueryContainer;
}

function buildNamedFilterClauses(criteria: SearchCriteria): NamedFilterClauses {
  const clauses: NamedFilterClauses = {};

  if (criteria.filters.categories.length > 0) {
    clauses.categories = {
      terms: {
        'category.normalized':
          criteria.filters.categories.map(normalizeKeyword),
      },
    };
  }
  if (criteria.filters.subcategories.length > 0) {
    clauses.subcategories = {
      terms: {
        'subcategories.normalized':
          criteria.filters.subcategories.map(normalizeKeyword),
      },
    };
  }
  if (criteria.filters.locations.length > 0) {
    clauses.locations = {
      terms: {
        'location.normalized': criteria.filters.locations.map(normalizeKeyword),
      },
    };
  }
  if (criteria.filters.price) {
    const range: estypes.QueryDslRangeQueryBase<number> = {};
    if (criteria.filters.price.min !== null)
      range.gte = criteria.filters.price.min;
    if (criteria.filters.price.max !== null)
      range.lte = criteria.filters.price.max;
    clauses.price = { range: { price: range } };
  }

  return clauses;
}

const FILTER_KEYS: (keyof NamedFilterClauses)[] = [
  'categories',
  'subcategories',
  'locations',
  'price',
];

function isDefined(
  clause: estypes.QueryDslQueryContainer | undefined,
): clause is estypes.QueryDslQueryContainer {
  return clause !== undefined;
}

function allClauses(
  named: NamedFilterClauses,
): estypes.QueryDslQueryContainer[] {
  return FILTER_KEYS.map((key) => named[key]).filter(isDefined);
}

function clausesExcept(
  named: NamedFilterClauses,
  exclude: keyof NamedFilterClauses,
): estypes.QueryDslQueryContainer[] {
  return FILTER_KEYS.filter((key) => key !== exclude)
    .map((key) => named[key])
    .filter(isDefined);
}

/** A `filter` clause for a facet's aggregation: all *other* active filters, ANDed. */
function facetFilter(
  clauses: estypes.QueryDslQueryContainer[],
): estypes.QueryDslQueryContainer {
  return clauses.length > 0 ? { bool: { filter: clauses } } : { match_all: {} };
}

function buildAggregations(
  named: NamedFilterClauses,
): Record<string, estypes.AggregationsAggregationContainer> {
  return {
    categories: {
      filter: facetFilter(clausesExcept(named, 'categories')),
      aggs: {
        values: { terms: { field: 'category', size: FACET_SIZE.categories } },
      },
    },
    subcategories: {
      filter: facetFilter(clausesExcept(named, 'subcategories')),
      aggs: {
        values: {
          terms: { field: 'subcategories', size: FACET_SIZE.subcategories },
        },
      },
    },
    locations: {
      filter: facetFilter(clausesExcept(named, 'locations')),
      aggs: {
        values: { terms: { field: 'location', size: FACET_SIZE.locations } },
      },
    },
    price: {
      filter: facetFilter(clausesExcept(named, 'price')),
      aggs: { values: { stats: { field: 'price' } } },
    },
    // Unlike the facets above, `related` reflects everything the user
    // currently sees (all filters applied), since it suggests *additional*
    // related terms rather than being a togglable filter itself.
    related: {
      filter: facetFilter(allClauses(named)),
      aggs: {
        values: {
          significant_terms: {
            field: 'subcategories',
            size: RELATED_TERMS_SIZE,
          },
        },
      },
    },
  };
}

/**
 * Phrase suggester over `name.trigram` (shingles) for did-you-mean. The
 * `collate` check discards suggestions that wouldn't actually match any
 * document, so "did you mean X" is never shown for an X with zero results.
 */
function buildSuggest(query: string): estypes.SearchSuggester {
  return {
    did_you_mean: {
      text: query,
      phrase: {
        field: 'name.trigram',
        size: DID_YOU_MEAN_SIZE,
        gram_size: 3,
        max_errors: 2,
        confidence: 0,
        direct_generator: [
          { field: 'name.trigram', suggest_mode: 'always', min_word_length: 3 },
        ],
        collate: {
          query: {
            // Runtime Elasticsearch expects `source` to be the query clause
            // itself (a `match` here), but the client's `ScriptSource` type
            // models it as a full `SearchSearchRequestBody` (meant for
            // search templates) — wrapping this in an extra `query:` key to
            // satisfy that type produces a real request Elasticsearch
            // rejects with `parsing_exception: unknown query [query]`. The
            // cast documents that the SDK type is too broad here, not that
            // this shape is unusual.
            source: {
              match: {
                'name.trigram': { query: '{{suggestion}}', operator: 'and' },
              },
            } as estypes.ScriptSource,
          },
          prune: false,
        },
      },
    },
  };
}

/**
 * `popularity`/`id` are always appended as tie-breakers:
 * - after `_score` for `sort=relevance`, so two textually-tied documents
 *   don't order arbitrarily between requests;
 * - after `popularity`/`created_at` for the other modes, so `id` (unique)
 *   guarantees a stable order across pages even when two documents tie on
 *   the primary sort field.
 * Without `q`, "relevance" has nothing to score against (every document
 * would tie at `_score: 1.0`), so it degrades to popularity ("featured")
 * instead of an arbitrary order.
 */
function buildSort(criteria: SearchCriteria): estypes.SortCombinations[] {
  const order = criteria.sort.order;

  switch (criteria.sort.field) {
    case 'relevance':
      return criteria.query
        ? [{ _score: { order } }, { popularity: order }, { id: 'asc' }]
        : [{ popularity: order }, { id: 'asc' }];
    case 'popularity':
      return [{ popularity: order }, { id: 'asc' }];
    case 'createdAt':
      return [{ created_at: order }, { id: 'asc' }];
  }
}

export function buildSearchQuery(
  criteria: SearchCriteria,
): ProductSearchRequestBody {
  const named = buildNamedFilterClauses(criteria);
  const activeClauses = allClauses(named);

  return {
    track_total_hits: true,
    from: criteria.pagination.from,
    size: criteria.pagination.size,
    _source: [...SOURCE_FIELDS],
    query: buildTextQuery(criteria.query),
    // Filters live in post_filter (not query) so the aggregations above,
    // which run against the query but before post_filter, can compute
    // sibling-facet counts — the multi-select faceting behavior.
    post_filter:
      activeClauses.length > 0
        ? { bool: { filter: activeClauses } }
        : undefined,
    aggs: buildAggregations(named),
    suggest: criteria.query ? buildSuggest(criteria.query) : undefined,
    sort: buildSort(criteria),
  };
}

/**
 * `name` is indexed with `product_autocomplete_index` (edge n-grams,
 * min_gram 2) but a plain `match` query analyzes the query text with the
 * field's `search_analyzer` (`product_search`, no n-grams) — so a `match`
 * on `name` is, by construction, exactly the prefix search autocomplete
 * needs, with no extra query-side work.
 */
export function buildAutocompleteQuery(
  prefix: string,
  limit: number,
): ProductAutocompleteRequestBody {
  return {
    query: { match: { name: prefix } },
    sort: [
      { _score: { order: 'desc' } },
      { popularity: 'desc' },
      { id: 'asc' },
    ],
    size: limit,
    _source: ['id', 'name'],
  };
}
