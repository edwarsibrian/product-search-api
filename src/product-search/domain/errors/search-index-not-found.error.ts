/**
 * Thrown by the Elasticsearch adapter when the products index doesn't
 * exist — i.e. nobody has run `npm run seed` yet. Maps to HTTP 503 via
 * `ProductSearchExceptionFilter`, with a message that tells the caller
 * exactly what to do instead of a generic "not found".
 */
export class SearchIndexNotFoundError extends Error {
  constructor(indexName: string) {
    super(
      `Product index '${indexName}' does not exist. Run 'npm run seed' before searching.`,
    );
    this.name = 'SearchIndexNotFoundError';
  }
}
