import {
  EsAutocompleteResponse,
  EsSearchResponse,
  mapToAutocompleteSuggestions,
  mapToSearchResult,
} from './product-search.mapper';
import { SearchCriteria } from '../../domain/search-criteria';
import { Pagination } from '../../domain/value-objects/pagination.vo';
import {
  SortCriteria,
  SortField,
} from '../../domain/value-objects/sort-criteria.vo';
import type { ProductDocument } from './product-index.mapping';

function criteria(
  query: string | null,
  sortField: SortField = 'relevance',
): SearchCriteria {
  return {
    query,
    filters: { categories: [], subcategories: [], locations: [], price: null },
    sort: SortCriteria.create(sortField, 'desc'),
    pagination: Pagination.create(1, 20),
  };
}

const PRODUCT_A: ProductDocument = {
  id: 'laptop-dell-xps-13',
  name: 'Laptop Dell XPS 13',
  description: 'Ultrabook de 13 pulgadas.',
  category: 'Electrónica',
  subcategories: ['Portátiles'],
  location: 'Madrid',
  price: 1249,
  popularity: 71,
  created_at: '2024-11-02T09:00:00.000Z',
};

function baseResponse(
  overrides: Partial<EsSearchResponse> = {},
): EsSearchResponse {
  return {
    hits: {
      total: { value: 1 },
      hits: [{ _id: PRODUCT_A.id, _score: 12.43, _source: PRODUCT_A }],
    },
    ...overrides,
  };
}

describe('mapToSearchResult', () => {
  it('maps hits to products, converting created_at into a Date', () => {
    const result = mapToSearchResult(baseResponse(), criteria('laptop'));
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'laptop-dell-xps-13',
      name: 'Laptop Dell XPS 13',
      category: 'Electrónica',
      subcategories: ['Portátiles'],
      price: 1249,
      popularity: 71,
    });
    expect(result.items[0].createdAt).toEqual(
      new Date('2024-11-02T09:00:00.000Z'),
    );
  });

  it('includes the score only when sorting by relevance', () => {
    const relevance = mapToSearchResult(
      baseResponse(),
      criteria('laptop', 'relevance'),
    );
    expect(relevance.items[0].score).toBe(12.43);

    const byPopularity = mapToSearchResult(
      baseResponse(),
      criteria('laptop', 'popularity'),
    );
    expect(byPopularity.items[0].score).toBeNull();
  });

  it('maps terms aggregations into facet values', () => {
    const response = baseResponse({
      aggregations: {
        categories: {
          doc_count: 10,
          values: {
            buckets: [
              { key: 'Electrónica', doc_count: 13 },
              { key: 'Moda', doc_count: 11 },
            ],
          },
        },
      },
    });

    const result = mapToSearchResult(response, criteria(null));
    expect(result.facets.categories).toEqual([
      { value: 'Electrónica', count: 13 },
      { value: 'Moda', count: 11 },
    ]);
  });

  it('defaults facets to empty when there are no aggregations', () => {
    const result = mapToSearchResult(baseResponse(), criteria(null));
    expect(result.facets).toEqual({
      categories: [],
      subcategories: [],
      locations: [],
      price: { min: null, max: null, avg: null },
    });
  });

  it('maps the price stats aggregation', () => {
    const response = baseResponse({
      aggregations: {
        price: {
          doc_count: 53,
          values: { count: 53, min: 9.99, max: 1449, avg: 312.45 },
        },
      },
    });
    const result = mapToSearchResult(response, criteria(null));
    expect(result.facets.price).toEqual({ min: 9.99, max: 1449, avg: 312.45 });
  });

  it('excludes did-you-mean suggestions identical to the original query', () => {
    const response = baseResponse({
      suggest: {
        did_you_mean: [
          {
            text: 'lapto',
            options: [
              { text: 'lapto', score: 1 },
              { text: 'laptop', score: 0.9 },
            ],
          },
        ],
      },
    });
    const result = mapToSearchResult(response, criteria('lapto'));
    expect(result.suggestions.didYouMean).toEqual(['laptop']);
  });

  it('returns no did-you-mean suggestions when there was no query', () => {
    const response = baseResponse({
      suggest: {
        did_you_mean: [{ text: '', options: [{ text: 'laptop', score: 0.9 }] }],
      },
    });
    const result = mapToSearchResult(response, criteria(null));
    expect(result.suggestions.didYouMean).toEqual([]);
  });

  it('maps the significant_terms aggregation into related suggestions', () => {
    const response = baseResponse({
      aggregations: {
        related: {
          doc_count: 5,
          values: {
            buckets: [
              { key: 'Portátiles', doc_count: 5 },
              { key: 'Smartphones', doc_count: 3 },
            ],
          },
        },
      },
    });
    const result = mapToSearchResult(response, criteria(null));
    expect(result.suggestions.related).toEqual(['Portátiles', 'Smartphones']);
  });
});

describe('mapToAutocompleteSuggestions', () => {
  it('maps hits to text/productId pairs', () => {
    const response: EsAutocompleteResponse = {
      hits: {
        hits: [
          { _source: { id: 'laptop-dell-xps-13', name: 'Laptop Dell XPS 13' } },
          {
            _source: {
              id: 'laptop-apple-macbook-air-m2',
              name: 'Laptop Apple MacBook Air M2',
            },
          },
        ],
      },
    };

    expect(mapToAutocompleteSuggestions(response)).toEqual([
      { text: 'Laptop Dell XPS 13', productId: 'laptop-dell-xps-13' },
      {
        text: 'Laptop Apple MacBook Air M2',
        productId: 'laptop-apple-macbook-air-m2',
      },
    ]);
  });

  it('returns an empty array when there are no hits', () => {
    const response: EsAutocompleteResponse = { hits: { hits: [] } };
    expect(mapToAutocompleteSuggestions(response)).toEqual([]);
  });
});
