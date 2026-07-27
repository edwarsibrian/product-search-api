import { SearchCriteria } from '../../domain/search-criteria';
import { SearchResult } from '../../domain/search-result';
import { AutocompleteSuggestion } from '../../domain/autocomplete-suggestion';

export const PRODUCT_SEARCH_PORT = Symbol('PRODUCT_SEARCH_PORT');

/** Port for the search backend. Implemented by the Elasticsearch adapter. */
export interface ProductSearchPort {
  search(criteria: SearchCriteria): Promise<SearchResult>;
  autocomplete(
    prefix: string,
    limit: number,
  ): Promise<AutocompleteSuggestion[]>;
}
