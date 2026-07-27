export const PRODUCT_CACHE_PORT = Symbol('PRODUCT_CACHE_PORT');

/**
 * Port for the caching backend. Implemented by the Redis adapter, which
 * never lets a cache failure surface as an error — a miss/failure just
 * means "go to Elasticsearch instead" (see `RedisProductCacheAdapter`).
 */
export interface ProductCachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}
