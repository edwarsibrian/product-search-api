import { PriceRange } from './value-objects/price-range.vo';
import { Pagination } from './value-objects/pagination.vo';
import { SortCriteria } from './value-objects/sort-criteria.vo';

export interface SearchFilters {
  categories: string[];
  subcategories: string[];
  locations: string[];
  price: PriceRange | null;
}

export interface SearchCriteria {
  /** Free-text query. `null` means "no text" (browse/filter-only). */
  query: string | null;
  filters: SearchFilters;
  sort: SortCriteria;
  pagination: Pagination;
}
