import { InvalidSearchCriteriaError } from '../errors/invalid-search-criteria.error';

/**
 * Elasticsearch refuses `from + size` beyond `index.max_result_window`
 * (10000 by default) with an opaque 500. `Pagination.create` rejects that
 * combination up front with a message that tells the caller the actual
 * maximum page for their `limit`, instead of letting it reach ES at all.
 */
const MAX_RESULT_WINDOW = 10_000;

export class Pagination {
  private constructor(
    public readonly page: number,
    public readonly limit: number,
  ) {}

  static create(page: number, limit: number): Pagination {
    const from = (page - 1) * limit;

    if (from + limit > MAX_RESULT_WINDOW) {
      const maxPage = Math.floor(MAX_RESULT_WINDOW / limit);
      throw new InvalidSearchCriteriaError(
        `Pagination window exceeded: with limit=${limit} the maximum page is ${maxPage}`,
      );
    }

    return new Pagination(page, limit);
  }

  /** Zero-based offset for Elasticsearch's `from`. */
  get from(): number {
    return (this.page - 1) * this.limit;
  }

  /** Alias for `limit`, named to match Elasticsearch's `size`. */
  get size(): number {
    return this.limit;
  }
}
