/**
 * Dedicated index for e2e tests — never `products`, so `npm run test:e2e`
 * run locally against the same docker-compose stack a developer uses for
 * `npm run start:dev` doesn't clobber their seeded dev index.
 */
export const E2E_INDEX_NAME = 'products-e2e-test';

/**
 * Resolves the environment e2e tests run against. Connection settings
 * default to the local docker-compose stack but defer to whatever's
 * already set (so CI can override via job-level `env:`). Cache TTLs are
 * forced to `0` unconditionally — a hard requirement of the e2e
 * environment, not something CI or a local `.env` should be able to
 * override, since a cache hit would let one test's response leak into
 * another's assertions.
 */
export function resolveE2eEnv(): void {
  process.env.ELASTICSEARCH_NODE ??= 'http://localhost:9201';
  process.env.ELASTICSEARCH_PRODUCT_INDEX = E2E_INDEX_NAME;
  process.env.REDIS_HOST ??= 'localhost';
  process.env.REDIS_PORT ??= '6379';
  process.env.SEARCH_CACHE_TTL_SECONDS = '0';
  process.env.AUTOCOMPLETE_CACHE_TTL_SECONDS = '0';
}
