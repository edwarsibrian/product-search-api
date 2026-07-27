import { normalizeKeyword } from './keyword-normalizer';

describe('normalizeKeyword', () => {
  it('lowercases and strips accents, mirroring product_keyword_normalizer', () => {
    expect(normalizeKeyword('Electrónica')).toBe('electronica');
    expect(normalizeKeyword('PORTÁTILES')).toBe('portatiles');
    expect(normalizeKeyword('Ropa Deportiva')).toBe('ropa deportiva');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeKeyword('  Madrid  ')).toBe('madrid');
  });

  it('is idempotent', () => {
    const once = normalizeKeyword('Sevilla');
    expect(normalizeKeyword(once)).toBe(once);
  });
});
