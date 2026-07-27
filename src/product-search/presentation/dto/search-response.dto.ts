import {
  SortField,
  SortOrder,
} from '../../domain/value-objects/sort-criteria.vo';

export interface SearchResponseDto {
  query: {
    q: string | null;
    filters: {
      categories: string[];
      subcategories: string[];
      locations: string[];
      price: { min: number | null; max: number | null };
    };
    sort: { field: SortField; order: SortOrder };
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  results: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    subcategories: string[];
    location: string;
    price: number;
    popularity: number;
    createdAt: string;
    score: number | null;
  }>;
  facets: {
    categories: Array<{ value: string; count: number }>;
    subcategories: Array<{ value: string; count: number }>;
    locations: Array<{ value: string; count: number }>;
    price: { min: number | null; max: number | null; avg: number | null };
  };
  suggestions: {
    didYouMean: string[];
    related: string[];
  };
}
