import { SearchResult } from '../../domain/search-result';
import { SearchCriteria } from '../../domain/search-criteria';
import { SearchResponseDto } from '../dto/search-response.dto';

export function toSearchResponseDto(
  result: SearchResult,
  criteria: SearchCriteria,
): SearchResponseDto {
  const { page, limit } = criteria.pagination;
  const totalPages = limit > 0 ? Math.ceil(result.total / limit) : 0;

  return {
    query: {
      q: criteria.query,
      filters: {
        categories: criteria.filters.categories,
        subcategories: criteria.filters.subcategories,
        locations: criteria.filters.locations,
        price: {
          min: criteria.filters.price?.min ?? null,
          max: criteria.filters.price?.max ?? null,
        },
      },
      sort: { field: criteria.sort.field, order: criteria.sort.order },
    },
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    results: result.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      subcategories: item.subcategories,
      location: item.location,
      price: item.price,
      popularity: item.popularity,
      createdAt: item.createdAt.toISOString(),
      score: item.score,
    })),
    facets: result.facets,
    suggestions: result.suggestions,
  };
}
