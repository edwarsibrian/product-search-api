/**
 * Thrown by the Elasticsearch adapter for anything that isn't a missing
 * index — connection refused, timeout, cluster errors, etc. Maps to HTTP
 * 503 via `ProductSearchExceptionFilter`. The client only ever sees the
 * generic message below; the real error is logged server-side via `cause`.
 */
export class SearchUnavailableError extends Error {
  constructor(
    message = 'Search backend is temporarily unavailable',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SearchUnavailableError';
  }
}
