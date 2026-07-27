import { Logger } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { readNumberEnv } from '../config/read-number-env';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

const logger = new Logger('RedisClient');

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis => {
    const client = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: readNumberEnv(config, 'REDIS_PORT', 6379),
      // Fail fast instead of queuing requests while Redis is down — search
      // and autocomplete must degrade to Elasticsearch immediately, not
      // hang waiting for a reconnect.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    // ioredis emits 'error' on every connection hiccup; without a
    // listener, Node treats an unhandled 'error' event as fatal and
    // crashes the process. Redis being unreachable must never crash the API.
    client.on('error', (error: Error) => {
      logger.warn(`Redis connection error: ${error.message}`);
    });

    return client;
  },
};
