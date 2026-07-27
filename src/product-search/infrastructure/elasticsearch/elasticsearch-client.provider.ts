import { Client } from '@elastic/elasticsearch';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readNumberEnv } from '../config/read-number-env';
import { PRODUCT_INDEX_DEFAULT_NAME } from './product-index.constants';

export const ES_CLIENT = Symbol('ES_CLIENT');
export const PRODUCT_INDEX_NAME = Symbol('PRODUCT_INDEX_NAME');

export const elasticsearchClientProvider: Provider = {
  provide: ES_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Client =>
    new Client({
      node: config.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9201'),
      requestTimeout: readNumberEnv(
        config,
        'ELASTICSEARCH_REQUEST_TIMEOUT_MS',
        5000,
      ),
    }),
};

export const productIndexNameProvider: Provider = {
  provide: PRODUCT_INDEX_NAME,
  inject: [ConfigService],
  useFactory: (config: ConfigService): string =>
    config.get<string>(
      'ELASTICSEARCH_PRODUCT_INDEX',
      PRODUCT_INDEX_DEFAULT_NAME,
    ),
};
