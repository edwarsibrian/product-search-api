export type SortField = 'relevance' | 'popularity' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

/**
 * The set of valid `field`/`order` values is already enforced by
 * `class-validator` (`@IsIn`) at the presentation boundary before this VO
 * is ever constructed — so this class exists purely to give the domain a
 * typed, immutable value to work with, not to re-validate.
 */
export class SortCriteria {
  private constructor(
    public readonly field: SortField,
    public readonly order: SortOrder,
  ) {}

  static create(
    field: SortField = 'relevance',
    order: SortOrder = 'desc',
  ): SortCriteria {
    return new SortCriteria(field, order);
  }
}
