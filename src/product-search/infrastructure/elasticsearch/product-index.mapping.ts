import type { estypes } from '@elastic/elasticsearch';

/**
 * Index-time analyzer for `name`: tokenizes with the standard analyzer,
 * lowercases, strips accents, then expands each token into edge n-grams
 * (2..15 chars) via the `product_edge_ngram` filter. "mesa" is indexed as
 * the tokens `me`, `mes`, `mesa`.
 */
const AUTOCOMPLETE_INDEX_ANALYZER = 'product_autocomplete_index';

/**
 * Search-time analyzer for `name`: same normalization as the index
 * analyzer, but WITHOUT the edge n-gram filter. A query for "mesa" stays a
 * single token, so it matches by prefix against what was indexed instead of
 * exploding into `me`/`mes`/`mesa` and over-matching anything that merely
 * starts with those letters.
 */
const SEARCH_ANALYZER = 'product_search';

/**
 * Analyzer for the `name.trigram` sub-field: standard tokenization plus
 * shingles (2-3 word sequences), which is what the phrase suggester needs
 * to power "did you mean" spelling corrections.
 */
const TRIGRAM_ANALYZER = 'product_trigram';

/**
 * Normalizer applied to the `.normalized` sub-fields of keyword facets
 * (category, subcategories, location). Lowercases and strips accents so
 * filtering is case- and accent-insensitive, while the parent keyword field
 * keeps the original casing for aggregation buckets shown back to clients.
 */
const KEYWORD_NORMALIZER = 'product_keyword_normalizer';

export const PRODUCT_INDEX_SETTINGS = {
  number_of_shards: 1,
  // A single node (docker-compose / CI) can never assign a replica, which
  // would leave the cluster stuck yellow and fail any healthcheck expecting
  // green.
  number_of_replicas: 0,
  analysis: {
    filter: {
      product_edge_ngram: {
        type: 'edge_ngram',
        min_gram: 2,
        max_gram: 15,
      },
      product_shingle: {
        type: 'shingle',
        min_shingle_size: 2,
        max_shingle_size: 3,
      },
    },
    normalizer: {
      [KEYWORD_NORMALIZER]: {
        type: 'custom',
        filter: ['lowercase', 'asciifolding'],
      },
    },
    analyzer: {
      [AUTOCOMPLETE_INDEX_ANALYZER]: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding', 'product_edge_ngram'],
      },
      [SEARCH_ANALYZER]: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding'],
      },
      [TRIGRAM_ANALYZER]: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'product_shingle'],
      },
    },
  },
} satisfies estypes.IndicesIndexSettings;

/**
 * Keyword facet field (category, subcategories, location): keeps the
 * original value for aggregation buckets, plus a `.normalized` sub-field
 * (lowercased, accent-stripped) so filtering by query param is
 * case/accent-insensitive.
 */
function keywordFacetProperty(): estypes.MappingProperty {
  return {
    type: 'keyword',
    fields: {
      normalized: {
        type: 'keyword',
        normalizer: KEYWORD_NORMALIZER,
      },
    },
  } satisfies estypes.MappingKeywordProperty;
}

export const PRODUCT_INDEX_MAPPINGS = {
  properties: {
    id: {
      type: 'keyword',
    },
    name: {
      type: 'text',
      analyzer: AUTOCOMPLETE_INDEX_ANALYZER,
      search_analyzer: SEARCH_ANALYZER,
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
        trigram: {
          type: 'text',
          analyzer: TRIGRAM_ANALYZER,
        },
      },
    },
    description: {
      type: 'text',
      // No edge n-grams here on purpose: ngramming long descriptions bloats
      // the index without helping autocomplete. This field only feeds
      // relevance scoring and suggester vocabulary.
      analyzer: SEARCH_ANALYZER,
    },
    category: keywordFacetProperty(),
    subcategories: keywordFacetProperty(),
    location: keywordFacetProperty(),
    price: {
      type: 'scaled_float',
      // Stored as an integer number of cents internally: exact for money,
      // and immune to the floating-point rounding that plain `double` range
      // queries can hit at the boundaries.
      scaling_factor: 100,
    },
    popularity: {
      type: 'integer',
    },
    created_at: {
      type: 'date',
      // Explicit format so a malformed value in the seed dataset fails to
      // index instead of silently coercing.
      format: 'strict_date_optional_time',
    },
  },
} satisfies estypes.MappingTypeMapping;

/**
 * Shape of a product document as stored in Elasticsearch (the `_source`).
 * Lives in `infrastructure/` rather than `domain/`: it mirrors the ES index
 * schema, not the business entity. The domain entity and its mapper are
 * responsible for keeping that schema from leaking into the domain.
 */
export interface ProductDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategories: string[];
  location: string;
  /** Price in the document's currency unit, e.g. 19.99. */
  price: number;
  popularity: number;
  /** ISO 8601 date-time string. */
  created_at: string;
}
