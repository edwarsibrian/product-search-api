import type { ProductDocument } from './product-index.mapping';
import { ScoredProduct, SearchResult } from '../../domain/search-result';
import { Facets, FacetValue } from '../../domain/facets';
import { Suggestions } from '../../domain/suggestions';
import { SearchCriteria } from '../../domain/search-criteria';
import { AutocompleteSuggestion } from '../../domain/autocomplete-suggestion';

/**
 * Narrow shape of the parts of the Elasticsearch response this mapper
 * reads. Deliberately decoupled from `@elastic/elasticsearch`'s very loose
 * `AggregationsAggregate` union (a huge discriminated union covering every
 * aggregation type ES supports) so the mapper — and its unit tests — can
 * work with plain, predictable object literals. It's the repository's job
 * to ensure the real response actually has this shape, since it's also the
 * one building the request in `product-query.builder.ts`.
 */
export interface EsTermsBucket {
  key: string;
  doc_count: number;
}

export interface EsFilterAggWithTerms {
  doc_count: number;
  values: { buckets: EsTermsBucket[] };
}

export interface EsFilterAggWithStats {
  doc_count: number;
  values: {
    count: number;
    min: number | null;
    max: number | null;
    avg: number | null;
  };
}

export interface EsFilterAggWithSignificantTerms {
  doc_count: number;
  values: { buckets: EsTermsBucket[] };
}

export interface EsSearchResponse {
  hits: {
    total: { value: number };
    hits: Array<{
      _id: string;
      _score: number | null;
      _source: ProductDocument;
    }>;
  };
  aggregations?: {
    categories?: EsFilterAggWithTerms;
    subcategories?: EsFilterAggWithTerms;
    locations?: EsFilterAggWithTerms;
    price?: EsFilterAggWithStats;
    related?: EsFilterAggWithSignificantTerms;
  };
  suggest?: {
    did_you_mean?: Array<{
      text: string;
      options: Array<{ text: string; score: number }>;
    }>;
  };
}

export interface EsAutocompleteResponse {
  hits: {
    hits: Array<{ _source: Pick<ProductDocument, 'id' | 'name'> }>;
  };
}

function toFacetValues(agg: EsFilterAggWithTerms | undefined): FacetValue[] {
  return (agg?.values.buckets ?? []).map((bucket) => ({
    value: bucket.key,
    count: bucket.doc_count,
  }));
}

/**
 * Suggestions identical to the original query aren't useful "did you
 * mean"s — the phrase suggester can return the input verbatim when it's
 * already the closest match to itself.
 */
function toDidYouMean(
  response: EsSearchResponse,
  originalQuery: string | null,
): string[] {
  if (!originalQuery) return [];

  const options = response.suggest?.did_you_mean?.[0]?.options ?? [];
  const normalizedOriginal = originalQuery.trim().toLowerCase();

  return options
    .map((option) => option.text)
    .filter((text) => text.toLowerCase() !== normalizedOriginal);
}

function toProduct(source: ProductDocument): Omit<ScoredProduct, 'score'> {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    category: source.category,
    subcategories: source.subcategories,
    location: source.location,
    price: source.price,
    popularity: source.popularity,
    createdAt: new Date(source.created_at),
  };
}

export function mapToSearchResult(
  response: EsSearchResponse,
  criteria: SearchCriteria,
): SearchResult {
  // Scoring is only computed (and only meaningful) when sorting by
  // relevance — paying for/exposing a score under sort=popularity or
  // sort=createdAt would be misleading, since it played no part in the order.
  const includeScore = criteria.sort.field === 'relevance';

  const items: ScoredProduct[] = response.hits.hits.map((hit) => ({
    ...toProduct(hit._source),
    score: includeScore ? (hit._score ?? null) : null,
  }));

  const facets: Facets = {
    categories: toFacetValues(response.aggregations?.categories),
    subcategories: toFacetValues(response.aggregations?.subcategories),
    locations: toFacetValues(response.aggregations?.locations),
    price: {
      min: response.aggregations?.price?.values.min ?? null,
      max: response.aggregations?.price?.values.max ?? null,
      avg: response.aggregations?.price?.values.avg ?? null,
    },
  };

  const suggestions: Suggestions = {
    didYouMean: toDidYouMean(response, criteria.query),
    related: (response.aggregations?.related?.values.buckets ?? []).map(
      (bucket) => bucket.key,
    ),
  };

  return {
    items,
    total: response.hits.total.value,
    facets,
    suggestions,
  };
}

export function mapToAutocompleteSuggestions(
  response: EsAutocompleteResponse,
): AutocompleteSuggestion[] {
  return response.hits.hits.map((hit) => ({
    text: hit._source.name,
    productId: hit._source.id,
  }));
}
