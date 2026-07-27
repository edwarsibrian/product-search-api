/**
 * The business entity for a product, as the domain and application layers
 * see it. Distinct from `ProductDocument` (in
 * `infrastructure/elasticsearch/product-index.mapping.ts`), which describes
 * the Elasticsearch `_source` shape — the repository adapter is what
 * translates between the two, so the ES schema never leaks past
 * `infrastructure/`.
 */
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly subcategories: string[];
  readonly location: string;
  readonly price: number;
  readonly popularity: number;
  readonly createdAt: Date;
}
