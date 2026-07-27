import { Product } from './product.entity';
import { Facets } from './facets';
import { Suggestions } from './suggestions';

export interface ScoredProduct extends Product {
  /** Elasticsearch relevance score; `null` when the result isn't sorted by relevance. */
  score: number | null;
}

export interface SearchResult {
  items: ScoredProduct[];
  /** Total number of matches, independent of the current page's `items.length`. */
  total: number;
  facets: Facets;
  suggestions: Suggestions;
}
