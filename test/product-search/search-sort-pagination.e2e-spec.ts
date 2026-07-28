import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import type { SearchResponseDto } from '../../src/product-search/presentation/dto/search-response.dto';

function ids(body: SearchResponseDto): string[] {
  return body.results.map((r) => r.id);
}

describe('Product search — sorting and pagination (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('pagination', () => {
    it('returns page 1 with hasNext true and hasPrevious false', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ limit: 3, page: 1, sort: 'popularity', order: 'desc' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 3,
        total: 9,
        totalPages: 3,
        hasNext: true,
        hasPrevious: false,
      });
      expect(ids(body)).toEqual([
        'smartphone-samsung-galaxy-s24',
        'laptop-hp-pavilion-15',
        'bolso-cuero-artesanal',
      ]);
    });

    it('returns page 2 with a different slice and hasPrevious true', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ limit: 3, page: 2, sort: 'popularity', order: 'desc' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(body.pagination).toMatchObject({
        page: 2,
        limit: 3,
        total: 9,
        totalPages: 3,
        hasNext: true,
        hasPrevious: true,
      });
      expect(ids(body)).toEqual([
        'zapatillas-nike-air-max',
        'laptop-lenovo-thinkpad-e14',
        'laptop-dell-xps-13',
      ]);
    });

    it('returns the last page with hasNext false', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ limit: 3, page: 3, sort: 'popularity', order: 'desc' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(body.pagination).toMatchObject({
        page: 3,
        hasNext: false,
        hasPrevious: true,
      });
      expect(ids(body)).toEqual([
        'smartphone-xiaomi-redmi-note-13',
        'zapatillas-adidas-ultraboost',
        'cinturon-piel-clasico',
      ]);
    });
  });

  describe('sort=popularity', () => {
    it('sorts descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ limit: 9, sort: 'popularity', order: 'desc' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(ids(body)).toEqual([
        'smartphone-samsung-galaxy-s24',
        'laptop-hp-pavilion-15',
        'bolso-cuero-artesanal',
        'zapatillas-nike-air-max',
        'laptop-lenovo-thinkpad-e14',
        'laptop-dell-xps-13',
        'smartphone-xiaomi-redmi-note-13',
        'zapatillas-adidas-ultraboost',
        'cinturon-piel-clasico',
      ]);
    });

    it('sorts ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ limit: 9, sort: 'popularity', order: 'asc' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(ids(body)).toEqual([
        'cinturon-piel-clasico',
        'zapatillas-adidas-ultraboost',
        'smartphone-xiaomi-redmi-note-13',
        'laptop-dell-xps-13',
        'laptop-lenovo-thinkpad-e14',
        'zapatillas-nike-air-max',
        'bolso-cuero-artesanal',
        'laptop-hp-pavilion-15',
        'smartphone-samsung-galaxy-s24',
      ]);
    });
  });

  describe('sort=createdAt', () => {
    it('sorts descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ limit: 9, sort: 'createdAt', order: 'desc' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(ids(body)).toEqual([
        'bolso-cuero-artesanal',
        'smartphone-xiaomi-redmi-note-13',
        'zapatillas-nike-air-max',
        'laptop-lenovo-thinkpad-e14',
        'laptop-hp-pavilion-15',
        'cinturon-piel-clasico',
        'laptop-dell-xps-13',
        'smartphone-samsung-galaxy-s24',
        'zapatillas-adidas-ultraboost',
      ]);
    });

    it('sorts ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ limit: 9, sort: 'createdAt', order: 'asc' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(ids(body)).toEqual([
        'zapatillas-adidas-ultraboost',
        'smartphone-samsung-galaxy-s24',
        'laptop-dell-xps-13',
        'cinturon-piel-clasico',
        'laptop-hp-pavilion-15',
        'laptop-lenovo-thinkpad-e14',
        'zapatillas-nike-air-max',
        'smartphone-xiaomi-redmi-note-13',
        'bolso-cuero-artesanal',
      ]);
    });
  });

  describe('sort=relevance', () => {
    it('only scores and returns text matches, ordered by relevance', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ q: 'laptop', sort: 'relevance', order: 'desc' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(ids(body).sort()).toEqual(
        [
          'laptop-dell-xps-13',
          'laptop-hp-pavilion-15',
          'laptop-lenovo-thinkpad-e14',
        ].sort(),
      );
    });
  });
});
