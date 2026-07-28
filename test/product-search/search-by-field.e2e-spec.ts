import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import type { SearchResponseDto } from '../../src/product-search/presentation/dto/search-response.dto';

describe('Product search — individual field search (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('by name (q)', () => {
    it('matches every "Laptop *" product and nothing else', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ q: 'laptop' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      const ids = body.results.map((r) => r.id).sort();
      expect(ids).toEqual(
        [
          'laptop-dell-xps-13',
          'laptop-hp-pavilion-15',
          'laptop-lenovo-thinkpad-e14',
        ].sort(),
      );
      expect(body.pagination.total).toBe(3);
      for (const result of body.results) {
        expect(result.score).not.toBeNull();
      }
    });

    it('suggests a spelling correction for a typo', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ q: 'lapto' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(body.suggestions.didYouMean).toContain('laptop');
    });
  });

  describe('by category', () => {
    it('returns only products in that category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ category: 'Moda' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(body.pagination.total).toBe(4);
      for (const result of body.results) {
        expect(result.category).toBe('Moda');
      }
    });
  });

  describe('by subcategory', () => {
    it('returns only products in that subcategory', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ subcategory: 'Accesorios' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      const ids = body.results.map((r) => r.id).sort();
      expect(ids).toEqual(
        ['bolso-cuero-artesanal', 'cinturon-piel-clasico'].sort(),
      );
    });
  });

  describe('by location', () => {
    it('returns only products in that location', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ location: 'Barcelona' })
        .expect(200);
      const body = response.body as SearchResponseDto;

      expect(body.pagination.total).toBe(4);
      for (const result of body.results) {
        expect(result.location).toBe('Barcelona');
      }
    });
  });

  describe('by price range', () => {
    it('filters by minPrice', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ minPrice: 700 })
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

    it('filters by maxPrice', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ maxPrice: 100 })
        .expect(200);
      const body = response.body as SearchResponseDto;

      const ids = body.results.map((r) => r.id).sort();
      expect(ids).toEqual(
        ['bolso-cuero-artesanal', 'cinturon-piel-clasico'].sort(),
      );
    });

    it('filters by a min/max range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ minPrice: 100, maxPrice: 200 })
        .expect(200);
      const body = response.body as SearchResponseDto;

      const ids = body.results.map((r) => r.id).sort();
      expect(ids).toEqual(
        ['zapatillas-nike-air-max', 'zapatillas-adidas-ultraboost'].sort(),
      );
    });
  });
});
