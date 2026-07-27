import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { ProductCachePort } from '../../application/ports/product-cache.port';
import { REDIS_CLIENT } from './redis-client.provider';

/**
 * Never lets a cache failure become a request failure: every method
 * catches, logs a warning, and returns the "cache miss" behavior (`null`
 * from `get`, silent no-op from `set`), so a down Redis just means every
 * request falls through to Elasticsearch instead of degraded latency
 * turning into a 500.
 */
@Injectable()
export class RedisProductCacheAdapter implements ProductCachePort {
  private readonly logger = new Logger(RedisProductCacheAdapter.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(
        `Cache read failed for key "${key}": ${this.describe(error)}`,
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Cache write failed for key "${key}": ${this.describe(error)}`,
      );
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
