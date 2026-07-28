import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap/configure-app';
import { PRODUCT_INDEX_NAME } from '../../src/product-search/infrastructure/elasticsearch/elasticsearch-client.provider';
import type { SearchResponseDto } from '../../src/product-search/presentation/dto/search-response.dto';
import type { ErrorResponseBody } from './support/error-response';

describe('Product search — edge cases (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the full catalog, paginated, for an empty search', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .expect(200);
    const body = response.body as SearchResponseDto;

    expect(body.pagination.total).toBe(9);
    expect(body.results.length).toBeGreaterThan(0);
  });

  it('returns zero results (not an error) for a filter matching nothing', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ category: 'NoExiste' })
      .expect(200);
    const body = response.body as SearchResponseDto;

    expect(body.results).toEqual([]);
    expect(body.pagination.total).toBe(0);
    expect(body.facets).toBeDefined();
  });

  it('returns zero results for contradictory filters, with facets explaining why', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ category: 'Moda', subcategory: 'Portátiles' })
      .expect(200);
    const body = response.body as SearchResponseDto;

    expect(body.results).toEqual([]);
    expect(body.pagination.total).toBe(0);
    // categories facet is scoped by subcategory=Portátiles alone (its own
    // dimension isn't filtered here) — only Electrónica has that subcategory.
    expect(body.facets.categories).toEqual([
      { value: 'Electrónica', count: 3 },
    ]);
  });

  it('returns empty results with coherent pagination for a page beyond the total, within the ES window', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ page: 10, limit: 20 })
      .expect(200);
    const body = response.body as SearchResponseDto;

    expect(body.results).toEqual([]);
    expect(body.pagination.total).toBe(9);
    expect(body.pagination.hasNext).toBe(false);
    expect(body.pagination.hasPrevious).toBe(true);
  });

  it('rejects a page/limit combination beyond max_result_window with 400', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ page: 501, limit: 20 })
      .expect(400);
    const body = response.body as ErrorResponseBody;

    expect(String(body.message)).toMatch(/Pagination window exceeded/);
  });

  it('rejects minPrice > maxPrice with 400', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ minPrice: 100, maxPrice: 10 })
      .expect(400);
    const body = response.body as ErrorResponseBody;

    expect(String(body.message)).toMatch(/cannot be greater than/);
  });

  it('rejects an unknown query param with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ categoryyy: 'x' })
      .expect(400);
  });

  describe('against a nonexistent index', () => {
    let brokenApp: INestApplication<App>;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PRODUCT_INDEX_NAME)
        .useValue('products-does-not-exist')
        .compile();

      brokenApp = moduleRef.createNestApplication();
      configureApp(brokenApp);
      await brokenApp.init();
    });

    afterAll(async () => {
      await brokenApp.close();
    });

    it('returns 503 with a message pointing at npm run seed', async () => {
      const response = await request(brokenApp.getHttpServer())
        .get('/api/v1/products/search')
        .query({ q: 'laptop' })
        .expect(503);
      const body = response.body as ErrorResponseBody;

      expect(String(body.message)).toMatch(/npm run seed/);
    });
  });
});
