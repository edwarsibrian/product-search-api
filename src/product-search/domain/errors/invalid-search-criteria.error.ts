/**
 * Thrown when a `SearchCriteria` value object detects an invariant
 * violation (e.g. `minPrice > maxPrice`, a pagination window past what
 * Elasticsearch allows). Maps to HTTP 400 via
 * `ProductSearchExceptionFilter`.
 */
export class InvalidSearchCriteriaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSearchCriteriaError';
  }
}
