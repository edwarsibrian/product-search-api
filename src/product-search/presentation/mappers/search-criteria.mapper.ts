import { SearchProductsQueryDto } from '../dto/search-products-query.dto';
import { SearchCriteria } from '../../domain/search-criteria';
import { PriceRange } from '../../domain/value-objects/price-range.vo';
import { Pagination } from '../../domain/value-objects/pagination.vo';
import { SortCriteria } from '../../domain/value-objects/sort-criteria.vo';

/**
 * Can throw `InvalidSearchCriteriaError` (from `PriceRange.create` /
 * `Pagination.create`) — left uncaught here so it propagates to
 * `ProductSearchExceptionFilter`, which turns it into a 400.
 */
export function toSearchCriteria(dto: SearchProductsQueryDto): SearchCriteria {
  return {
    query: dto.q ? dto.q : null,
    filters: {
      categories: dto.category,
      subcategories: dto.subcategory,
      locations: dto.location,
      price: PriceRange.create(dto.minPrice, dto.maxPrice),
    },
    sort: SortCriteria.create(dto.sort, dto.order),
    pagination: Pagination.create(dto.page, dto.limit),
  };
}
