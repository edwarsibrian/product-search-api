import { Client } from '@elastic/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import {
  PRODUCT_INDEX_MAPPINGS,
  PRODUCT_INDEX_SETTINGS,
} from '../../../src/product-search/infrastructure/elasticsearch/product-index.mapping';
import { E2E_INDEX_NAME, resolveE2eEnv } from './e2e-env';
import { E2E_PRODUCTS } from './e2e-products.fixture';

/**
 * Jest `globalSetup`: runs once before every e2e spec file, in the main
 * Jest process — env vars set here propagate to the workers Jest spawns
 * for each spec file, since those are forked after this runs. Recreates
 * and seeds the dedicated e2e index once for the whole run; all specs are
 * read-only against it, so a single shared seed is safe and much faster
 * than reseeding per file.
 */
export default async function globalSetup(): Promise<void> {
  resolveE2eEnv();

  const client = new Client({ node: process.env.ELASTICSEARCH_NODE });

  const exists = await client.indices.exists({ index: E2E_INDEX_NAME });
  if (exists) {
    await client.indices.delete({ index: E2E_INDEX_NAME });
  }
  await client.indices.create({
    index: E2E_INDEX_NAME,
    settings: PRODUCT_INDEX_SETTINGS,
    mappings: PRODUCT_INDEX_MAPPINGS,
  });

  const operations = E2E_PRODUCTS.flatMap((product) => [
    {
      index: { _index: E2E_INDEX_NAME, _id: product.id },
    } satisfies estypes.BulkOperationContainer,
    product,
  ]);
  const response = await client.bulk({ operations, refresh: true });

  if (response.errors) {
    const failed = response.items.filter(
      (item) => (item.index?.error ?? item.create?.error) != null,
    );
    throw new Error(
      `Failed to seed ${failed.length}/${E2E_PRODUCTS.length} e2e fixture document(s) into "${E2E_INDEX_NAME}"`,
    );
  }

  await client.close();
}
