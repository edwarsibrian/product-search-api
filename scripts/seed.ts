import { Client } from '@elastic/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PRODUCT_INDEX_DEFAULT_NAME } from '../src/product-search/infrastructure/elasticsearch/product-index.constants';
import {
  PRODUCT_INDEX_MAPPINGS,
  PRODUCT_INDEX_SETTINGS,
  type ProductDocument,
} from '../src/product-search/infrastructure/elasticsearch/product-index.mapping';

const ELASTICSEARCH_NODE =
  process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9201';
const INDEX_NAME =
  process.env.ELASTICSEARCH_PRODUCT_INDEX ?? PRODUCT_INDEX_DEFAULT_NAME;
const PRODUCTS_FILE = join(__dirname, '..', 'data', 'products.json');

function loadProducts(): ProductDocument[] {
  const raw = readFileSync(PRODUCTS_FILE, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${PRODUCTS_FILE} must contain a non-empty JSON array`);
  }

  const products = parsed as ProductDocument[];
  const ids = products.map((product) => product.id);
  const missingId = products.find((product) => !product.id);
  if (missingId) {
    throw new Error(
      `Every product needs a non-empty "id" (used as the ES _id for idempotent re-seeding)`,
    );
  }
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate product ids in ${PRODUCTS_FILE}: ${[...new Set(duplicateIds)].join(', ')}`,
    );
  }

  return products;
}

async function recreateIndex(client: Client): Promise<void> {
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (exists) {
    await client.indices.delete({ index: INDEX_NAME });
  }

  await client.indices.create({
    index: INDEX_NAME,
    settings: PRODUCT_INDEX_SETTINGS,
    mappings: PRODUCT_INDEX_MAPPINGS,
  });
}

async function bulkIndex(
  client: Client,
  products: ProductDocument[],
): Promise<void> {
  const operations = products.flatMap((product) => [
    {
      index: { _index: INDEX_NAME, _id: product.id },
    } satisfies estypes.BulkOperationContainer,
    product,
  ]);

  const response = await client.bulk({ operations, refresh: true });

  if (response.errors) {
    const failed = response.items.filter(
      (item) => (item.index?.error ?? item.create?.error) != null,
    );
    const preview = failed
      .slice(0, 5)
      .map(
        (item) =>
          `${item.index?._id ?? item.create?._id}: ${JSON.stringify(item.index?.error ?? item.create?.error)}`,
      )
      .join('\n');
    throw new Error(
      `Bulk indexing failed for ${failed.length}/${products.length} document(s):\n${preview}`,
    );
  }
}

async function main(): Promise<void> {
  const products = loadProducts();
  const client = new Client({ node: ELASTICSEARCH_NODE });

  console.log(`Seeding index "${INDEX_NAME}" at ${ELASTICSEARCH_NODE}...`);

  await recreateIndex(client);
  await bulkIndex(client, products);

  const { count } = await client.count({ index: INDEX_NAME });

  console.log(`Indexed ${products.length} product(s) from ${PRODUCTS_FILE}.`);
  console.log(
    `Index "${INDEX_NAME}" now holds ${count} document(s) and is ready to receive searches.`,
  );
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
