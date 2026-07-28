import { Client } from '@elastic/elasticsearch';
import { E2E_INDEX_NAME } from './e2e-env';

/**
 * Jest `globalTeardown`: deletes the dedicated e2e index after the whole
 * run finishes, so repeated local runs don't leave a stray index behind in
 * a developer's Elasticsearch. Purely hygiene — the index gets recreated
 * from scratch by `global-setup.ts` on the next run regardless.
 */
export default async function globalTeardown(): Promise<void> {
  const client = new Client({
    node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9201',
  });

  const exists = await client.indices.exists({ index: E2E_INDEX_NAME });
  if (exists) {
    await client.indices.delete({ index: E2E_INDEX_NAME });
  }

  await client.close();
}
