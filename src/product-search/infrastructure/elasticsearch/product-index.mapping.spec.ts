import type { estypes } from '@elastic/elasticsearch';
import {
  PRODUCT_INDEX_MAPPINGS,
  PRODUCT_INDEX_SETTINGS,
} from './product-index.mapping';

/**
 * Analyzers, search_analyzers and normalizers are wired into the mapping by
 * string name. A typo (e.g. 'product_serch') still compiles fine and would
 * only blow up when creating the index against a real Elasticsearch cluster.
 * These tests catch that class of mistake without needing infrastructure.
 */
function collectReferencedNames(
  properties: Record<string, estypes.MappingProperty>,
): { analyzers: string[]; normalizers: string[] } {
  const analyzers: string[] = [];
  const normalizers: string[] = [];

  for (const property of Object.values(properties)) {
    const prop = property as Record<string, unknown>;

    if (typeof prop.analyzer === 'string') analyzers.push(prop.analyzer);
    if (typeof prop.search_analyzer === 'string')
      analyzers.push(prop.search_analyzer);
    if (typeof prop.normalizer === 'string') normalizers.push(prop.normalizer);

    if (prop.fields) {
      const nested = collectReferencedNames(
        prop.fields as Record<string, estypes.MappingProperty>,
      );
      analyzers.push(...nested.analyzers);
      normalizers.push(...nested.normalizers);
    }
  }

  return { analyzers, normalizers };
}

describe('PRODUCT_INDEX_MAPPINGS / PRODUCT_INDEX_SETTINGS', () => {
  const { analyzers, normalizers } = collectReferencedNames(
    PRODUCT_INDEX_MAPPINGS.properties,
  );
  const definedAnalyzers = Object.keys(
    PRODUCT_INDEX_SETTINGS.analysis.analyzer,
  );
  const definedNormalizers = Object.keys(
    PRODUCT_INDEX_SETTINGS.analysis.normalizer,
  );

  it('references at least one analyzer and one normalizer, to guard against a no-op test', () => {
    expect(analyzers.length).toBeGreaterThan(0);
    expect(normalizers.length).toBeGreaterThan(0);
  });

  it('only references analyzers that are actually defined in settings', () => {
    for (const name of analyzers) {
      expect(definedAnalyzers).toContain(name);
    }
  });

  it('only references normalizers that are actually defined in settings', () => {
    for (const name of normalizers) {
      expect(definedNormalizers).toContain(name);
    }
  });

  it('uses a different search_analyzer than analyzer for name, so search queries do not get exploded into edge n-grams and over-match', () => {
    const name = PRODUCT_INDEX_MAPPINGS.properties
      .name as estypes.MappingTextProperty;

    expect(name.analyzer).toBeDefined();
    expect(name.search_analyzer).toBeDefined();
    expect(name.search_analyzer).not.toBe(name.analyzer);
  });

  it('stores price as scaled_float with cent precision', () => {
    const price = PRODUCT_INDEX_MAPPINGS.properties
      .price as estypes.MappingScaledFloatNumberProperty;

    expect(price.type).toBe('scaled_float');
    expect(price.scaling_factor).toBe(100);
  });

  it('disables replicas, so a single-node cluster (docker-compose/CI) stays green', () => {
    expect(PRODUCT_INDEX_SETTINGS.number_of_replicas).toBe(0);
  });
});
