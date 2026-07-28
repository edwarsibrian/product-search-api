import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import type { AutocompleteResponseDto } from '../../src/product-search/presentation/dto/autocomplete-response.dto';

describe('Autocomplete (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the full "Laptop *" cluster for a matching prefix', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/autocomplete')
      .query({ q: 'lap' })
      .expect(200);
    const body = response.body as AutocompleteResponseDto;

    const ids = body.suggestions.map((s) => s.productId).sort();
    expect(ids).toEqual(
      [
        'laptop-dell-xps-13',
        'laptop-hp-pavilion-15',
        'laptop-lenovo-thinkpad-e14',
      ].sort(),
    );
  });

  it('short-circuits a 1-character prefix without touching Elasticsearch', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/autocomplete')
      .query({ q: 'l' })
      .expect(200);
    const body = response.body as AutocompleteResponseDto;

    expect(body.suggestions).toEqual([]);
  });

  it('never reports a cache hit, since the e2e environment forces TTL=0', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/v1/products/autocomplete')
      .query({ q: 'lap' })
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/api/v1/products/autocomplete')
      .query({ q: 'lap' })
      .expect(200);

    expect((first.body as AutocompleteResponseDto).cached).toBe(false);
    expect((second.body as AutocompleteResponseDto).cached).toBe(false);
  });

  it('respects the limit param', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products/autocomplete')
      .query({ q: 'lap', limit: 2 })
      .expect(200);
    const body = response.body as AutocompleteResponseDto;

    expect(body.suggestions).toHaveLength(2);
  });

  it('requires q and rejects an empty request with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/products/autocomplete')
      .expect(400);
  });
});
