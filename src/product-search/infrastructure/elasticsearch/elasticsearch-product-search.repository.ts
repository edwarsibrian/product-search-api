import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Client } from '@elastic/elasticsearch';
import { errors as EsErrors } from '@elastic/elasticsearch';
import type { ProductSearchPort } from '../../application/ports/product-search.port';
import { SearchCriteria } from '../../domain/search-criteria';
import { SearchResult } from '../../domain/search-result';
import { AutocompleteSuggestion } from '../../domain/autocomplete-suggestion';
import { SearchUnavailableError } from '../../domain/errors/search-unavailable.error';
import { SearchIndexNotFoundError } from '../../domain/errors/search-index-not-found.error';
import { ES_CLIENT, PRODUCT_INDEX_NAME } from './elasticsearch-client.provider';
import {
  buildAutocompleteQuery,
  buildSearchQuery,
} from './product-query.builder';
import {
  EsAutocompleteResponse,
  EsSearchResponse,
  mapToAutocompleteSuggestions,
  mapToSearchResult,
} from './product-search.mapper';

@Injectable()
export class ElasticsearchProductSearchRepository implements ProductSearchPort {
  private readonly logger = new Logger(
    ElasticsearchProductSearchRepository.name,
  );

  constructor(
    @Inject(ES_CLIENT) private readonly client: Client,
    @Inject(PRODUCT_INDEX_NAME) private readonly indexName: string,
  ) {}

  async search(criteria: SearchCriteria): Promise<SearchResult> {
    const body = buildSearchQuery(criteria);

    try {
      const response = await this.client.search({
        index: this.indexName,
        ...body,
      });
      return mapToSearchResult(
        response as unknown as EsSearchResponse,
        criteria,
      );
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async autocomplete(
    prefix: string,
    limit: number,
  ): Promise<AutocompleteSuggestion[]> {
    const body = buildAutocompleteQuery(prefix, limit);

    try {
      const response = await this.client.search({
        index: this.indexName,
        ...body,
      });
      return mapToAutocompleteSuggestions(
        response as unknown as EsAutocompleteResponse,
      );
    } catch (error) {
      throw this.translateError(error);
    }
  }

  private translateError(error: unknown): Error {
    if (error instanceof EsErrors.ResponseError) {
      const body = error.body as { error?: { type?: string } } | undefined;
      if (body?.error?.type === 'index_not_found_exception') {
        this.logger.warn(
          `Index "${this.indexName}" not found — has 'npm run seed' been run?`,
        );
        return new SearchIndexNotFoundError(this.indexName);
      }

      // Any other ResponseError (e.g. parsing_exception, illegal_argument_
      // exception) means Elasticsearch rejected a request WE built
      // incorrectly — a bug in this codebase, not an infrastructure
      // outage. Mapping it to SearchUnavailableError would mislead an
      // operator into checking the ES cluster instead of the query
      // builder. Rethrow the original error unhandled so it falls through
      // to Nest's default filter (a generic 500), with the real detail
      // only in this server-side log line.
      this.logger.error(`Elasticsearch rejected the request: ${error.message}`);
      return error;
    }

    if (
      error instanceof EsErrors.ConnectionError ||
      error instanceof EsErrors.TimeoutError ||
      error instanceof EsErrors.NoLivingConnectionsError
    ) {
      this.logger.error(`Elasticsearch is unreachable: ${error.message}`);
      return new SearchUnavailableError(
        'Search backend is temporarily unavailable',
        { cause: error },
      );
    }

    this.logger.error(
      `Unexpected error querying Elasticsearch: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new SearchUnavailableError(
      'Search backend is temporarily unavailable',
      { cause: error },
    );
  }
}
