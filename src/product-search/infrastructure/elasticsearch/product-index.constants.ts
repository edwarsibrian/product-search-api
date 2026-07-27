/**
 * Default name of the Elasticsearch index that stores products.
 *
 * This is only the fallback used when no environment configuration is
 * present. The real index name is expected to be resolved via
 * `@nestjs/config` (`ELASTICSEARCH_PRODUCT_INDEX`) once the config module
 * exists.
 */
export const PRODUCT_INDEX_DEFAULT_NAME = 'products';
