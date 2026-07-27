/**
 * JS mirror of the `product_keyword_normalizer` Elasticsearch normalizer
 * (lowercase + asciifolding) defined in `product-index.mapping.ts` and
 * applied to the `.normalized` sub-fields of category/subcategories/
 * location. Filter values coming from query params are normalized the
 * same way before being sent as `terms` filters, so `?category=electronica`
 * matches documents indexed with `category: "Electrónica"`.
 */
export function normalizeKeyword(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
