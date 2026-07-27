import { InvalidSearchCriteriaError } from '../errors/invalid-search-criteria.error';

/**
 * A price range filter. `create` returns `null` when neither bound was
 * given (i.e. "no price filter"), so callers never have to special-case an
 * "empty" range instance.
 */
export class PriceRange {
  private constructor(
    public readonly min: number | null,
    public readonly max: number | null,
  ) {}

  static create(min?: number, max?: number): PriceRange | null {
    const normalizedMin = min ?? null;
    const normalizedMax = max ?? null;

    if (normalizedMin === null && normalizedMax === null) {
      return null;
    }

    if (
      normalizedMin !== null &&
      normalizedMax !== null &&
      normalizedMin > normalizedMax
    ) {
      throw new InvalidSearchCriteriaError(
        `minPrice (${normalizedMin}) cannot be greater than maxPrice (${normalizedMax})`,
      );
    }

    return new PriceRange(normalizedMin, normalizedMax);
  }
}
