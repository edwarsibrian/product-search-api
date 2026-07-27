export interface Suggestions {
  /** Spelling-correction candidates for the query, from the phrase suggester. */
  didYouMean: string[];
  /** Related subcategories, from a significant_terms aggregation. */
  related: string[];
}
