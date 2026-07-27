import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Client } from '@elastic/elasticsearch';
import type Redis from 'ioredis';
import { ProductSearchController } from './presentation/product-search.controller';
import { SearchProductsUseCase } from './application/search-products.usecase';
import { AutocompleteProductsUseCase } from './application/autocomplete-products.usecase';
import { PRODUCT_SEARCH_PORT } from './application/ports/product-search.port';
import { PRODUCT_CACHE_PORT } from './application/ports/product-cache.port';
import {
  AUTOCOMPLETE_CACHE_TTL_SECONDS,
  SEARCH_CACHE_TTL_SECONDS,
} from './application/cache-ttl.tokens';
import { readNumberEnv } from './infrastructure/config/read-number-env';
import { ElasticsearchProductSearchRepository } from './infrastructure/elasticsearch/elasticsearch-product-search.repository';
import {
  ES_CLIENT,
  elasticsearchClientProvider,
  productIndexNameProvider,
} from './infrastructure/elasticsearch/elasticsearch-client.provider';
import { RedisProductCacheAdapter } from './infrastructure/redis/redis-product-cache.adapter';
import {
  REDIS_CLIENT,
  redisClientProvider,
} from './infrastructure/redis/redis-client.provider';

@Module({
  controllers: [ProductSearchController],
  providers: [
    elasticsearchClientProvider,
    productIndexNameProvider,
    redisClientProvider,
    {
      provide: PRODUCT_SEARCH_PORT,
      useClass: ElasticsearchProductSearchRepository,
    },
    { provide: PRODUCT_CACHE_PORT, useClass: RedisProductCacheAdapter },
    {
      provide: SEARCH_CACHE_TTL_SECONDS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): number =>
        readNumberEnv(config, 'SEARCH_CACHE_TTL_SECONDS', 60),
    },
    {
      provide: AUTOCOMPLETE_CACHE_TTL_SECONDS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): number =>
        readNumberEnv(config, 'AUTOCOMPLETE_CACHE_TTL_SECONDS', 300),
    },
    SearchProductsUseCase,
    AutocompleteProductsUseCase,
  ],
})
export class ProductSearchModule implements OnModuleDestroy {
  constructor(
    @Inject(ES_CLIENT) private readonly esClient: Client,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.esClient.close();
    this.redisClient.disconnect();
  }
}
