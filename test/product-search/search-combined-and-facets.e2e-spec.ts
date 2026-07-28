import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import type { SearchResponseDto } from '../../src/product-search/presentation/dto/search-response.dto';

describe('Product search — combined filters and faceting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('combines category + location filters (AND semantics)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ category: 'Electrónica', location: 'Madrid' })
      .expect(200);
    const body = response.body as SearchResponseDto;

    const ids = body.results.map((r) => r.id).sort();
    expect(ids).toEqual(
      [
        'laptop-dell-xps-13',
        'laptop-lenovo-thinkpad-e14',
        'smartphone-samsung-galaxy-s24',
      ].sort(),
    );
  });

  it('keeps sibling facet values visible after filtering (multi-select faceting)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ category: 'Electrónica' })
      .expect(200);
    const body = response.body as SearchResponseDto;

    expect(body.facets.categories).toEqual(
      expect.arrayContaining([
        { value: 'Electrónica', count: 5 },
        { value: 'Moda', count: 4 },
      ]),
    );
  });

  it('scopes each facet by every OTHER active filter, excluding its own dimension', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ category: 'Electrónica', location: 'Madrid' })
      .expect(200);
    const body = response.body as SearchResponseDto;

    // subcategories facet is scoped by category+location (its own dimension isn't filtered here).
    expect(body.facets.subcategories).toEqual(
      expect.arrayContaining([
        { value: 'Portátiles', count: 2 },
        { value: 'Smartphones', count: 1 },
      ]),
    );

    // locations facet excludes the location filter itself, so it's scoped by
    // category=Electrónica alone — both locations should still show counts.
    expect(body.facets.locations).toEqual(
      expect.arrayContaining([
        { value: 'Madrid', count: 3 },
        { value: 'Barcelona', count: 2 },
      ]),
    );
  });
});
