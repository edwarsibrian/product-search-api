import { PriceRange } from './price-range.vo';
import { InvalidSearchCriteriaError } from '../errors/invalid-search-criteria.error';

describe('PriceRange', () => {
  it('returns null when neither bound is given', () => {
    expect(PriceRange.create()).toBeNull();
  });

  it('accepts only a minimum', () => {
    const range = PriceRange.create(10);
    expect(range).not.toBeNull();
    expect(range?.min).toBe(10);
    expect(range?.max).toBeNull();
  });

  it('accepts only a maximum', () => {
    const range = PriceRange.create(undefined, 100);
    expect(range?.min).toBeNull();
    expect(range?.max).toBe(100);
  });

  it('accepts a full range', () => {
    const range = PriceRange.create(10, 100);
    expect(range?.min).toBe(10);
    expect(range?.max).toBe(100);
  });

  it('rejects min > max with a domain error', () => {
    expect(() => PriceRange.create(100, 10)).toThrow(
      InvalidSearchCriteriaError,
    );
  });

  it('accepts min === max', () => {
    const range = PriceRange.create(50, 50);
    expect(range?.min).toBe(50);
    expect(range?.max).toBe(50);
  });
});
