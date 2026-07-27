import { Pagination } from './pagination.vo';
import { InvalidSearchCriteriaError } from '../errors/invalid-search-criteria.error';

describe('Pagination', () => {
  it('computes a zero-based from offset', () => {
    expect(Pagination.create(1, 20).from).toBe(0);
    expect(Pagination.create(2, 20).from).toBe(20);
    expect(Pagination.create(5, 10).from).toBe(40);
  });

  it('exposes limit as size', () => {
    expect(Pagination.create(1, 20).size).toBe(20);
  });

  it('rejects a page/limit combination beyond the 10000 result window', () => {
    expect(() => Pagination.create(501, 20)).toThrow(
      InvalidSearchCriteriaError,
    );
  });

  it('accepts the last page still within the result window', () => {
    expect(() => Pagination.create(500, 20)).not.toThrow();
  });

  it('includes the actual maximum page for the given limit in the error message', () => {
    expect(() => Pagination.create(1000, 50)).toThrow(/maximum page is 200/);
  });
});
