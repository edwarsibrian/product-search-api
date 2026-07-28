import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/bootstrap/configure-app';

/**
 * Boots a real Nest application (full `AppModule` DI graph — real
 * Elasticsearch/Redis adapters, not fakes) with the exact same setup as
 * `main.ts` via the shared `configureApp`. Each `*.e2e-spec.ts` file calls
 * this once in `beforeAll` and closes it in `afterAll`.
 *
 * Declared to return `INestApplication<App>` (supertest's handler type)
 * instead of the default `INestApplication<any>`, matching the type each
 * spec file's `app` variable is declared with.
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}
