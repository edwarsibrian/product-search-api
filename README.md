# Product Search API

Advanced product search API (NestJS + Elasticsearch) — hexagonal architecture, autocomplete, faceting, relevance ranking.

[![CI](https://github.com/edwarsibrian/product-search-api/actions/workflows/ci.yml/badge.svg)](https://github.com/edwarsibrian/product-search-api/actions/workflows/ci.yml)

## About this project

This project started as a technical challenge for a hiring process, but it's built and maintained as a **portfolio project**: the goal is a clean, well-tested, production-shaped API rather than a submission that just checks boxes.

The stack is **NestJS** on top of **Elasticsearch** (search, ranking, faceting, autocomplete suggestions) and **Redis** (cache-aside for search/autocomplete responses). The codebase follows **hexagonal architecture** (ports & adapters) for the search feature:

```
src/product-search/
  domain/          # entities, value objects, domain errors — no framework, no ES/Redis imports
  application/      # use cases (SearchProductsUseCase, AutocompleteProductsUseCase) + ports
    ports/           # ProductSearchPort, ProductCachePort — interfaces the domain depends on
  infrastructure/
    elasticsearch/   # the ProductSearchPort adapter: query builder, response mapper, repository
    redis/           # the ProductCachePort adapter (cache-aside, never throws on failure)
  presentation/     # controller, DTOs (class-validator), mappers, exception filter
```

`domain/` never imports from `infrastructure/` or NestJS directly, and use cases depend only on the `ports/` interfaces — Nest's DI container wires the concrete Elasticsearch/Redis adapters in at the module level. This keeps the business rules (ranking, filtering, faceting) testable in isolation from any real database or cache.

There is deliberately **no relational database**. The original challenge doesn't require persistence beyond what's needed to search, and Elasticsearch's indexing already covers this domain end to end (search, filters, facets, ranking) — adding a Postgres/MySQL alongside it would only introduce a synchronization layer with no real benefit at this scope.

## Prerequisites

- [Node.js 24](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Elasticsearch + Redis)

## Installation and running

```bash
# 1. Clone and install dependencies
git clone https://github.com/edwarsibrian/product-search-api.git
cd product-search-api
npm install

# 2. Start Elasticsearch (host port 9201) and Redis (6379)
docker-compose up -d elasticsearch redis

# 3. Seed the product index — REQUIRED before the API can return any search
#    results. It creates the `products` index, applies the mapping (autocomplete
#    analyzers, keyword facets, price scaling, etc.) and bulk-loads data/products.json.
npm run seed

# 4. Start the API in watch mode
npm run start:dev
```

Confirm it's up:

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","timestamp":"..."}
```

Alternatively, `docker-compose up` (without restricting to `elasticsearch redis`) also builds and runs the API itself as a container on port 3000 — but `npm run seed` must still be run separately, since seeding isn't part of the image's startup.

Elasticsearch's data is persisted in the named volume `es-data`, so it survives `docker-compose down` (without `-v`) and container restarts — `npm run seed` doesn't need to be re-run every time the stack comes back up. Run `docker-compose down -v` if you want a clean reset (deletes the indexed data along with the volume).

## API

Base path: `/api/v1`. All endpoints return JSON. Unknown query parameters are rejected with `400` (validation is `whitelist: true, forbidNonWhitelisted: true`) rather than silently ignored.

### `GET /api/v1/products/search`

| Param | Type | Notes |
|---|---|---|
| `q` | string | Free-text search over name/description. Omitted → matches everything. |
| `category` | string \| string[] | Repeatable (`?category=A&category=B`) for multi-select. |
| `subcategory` | string \| string[] | Same as above. |
| `location` | string \| string[] | Same as above. |
| `minPrice` / `maxPrice` | number | Inclusive range. `minPrice` cannot exceed `maxPrice`. |
| `sort` | `relevance` \| `popularity` \| `createdAt` | Default `relevance`. Without `q`, relevance falls back to popularity ordering (there's no text to score). |
| `order` | `asc` \| `desc` | Default `desc`. |
| `page` | integer ≥ 1 | Default `1`. |
| `limit` | integer, 1–50 | Default `20`. `page`/`limit` combinations beyond Elasticsearch's `max_result_window` are rejected with `400`. |

Example — filtering by category, to illustrate **multi-select faceting**: `facets.categories` still lists every other category with its real count, not just the one selected, so a client can render "Electrónica (13) · Hogar y Muebles (11) · Moda (11) · Deporte y Fitness (10) · Libros (8)" as togglable options instead of collapsing to the active filter. This is a real, live response captured against the seeded dataset:

```
GET /api/v1/products/search?category=Electrónica&limit=3
```

```json
{
  "query": {
    "q": null,
    "filters": {
      "categories": ["Electrónica"],
      "subcategories": [],
      "locations": [],
      "price": { "min": null, "max": null }
    },
    "sort": { "field": "relevance", "order": "desc" }
  },
  "pagination": {
    "page": 1,
    "limit": 3,
    "total": 13,
    "totalPages": 5,
    "hasNext": true,
    "hasPrevious": false
  },
  "results": [
    {
      "id": "laptop-asus-zenbook-14",
      "name": "Laptop Asus ZenBook 14",
      "description": "Portátil ultraligero con pantalla OLED y acabado premium en aluminio cepillado.",
      "category": "Electrónica",
      "subcategories": ["Portátiles"],
      "location": "Sevilla",
      "price": 999.99,
      "popularity": 96,
      "createdAt": "2025-04-07T09:00:00.000Z",
      "score": null
    }
  ],
  "facets": {
    "categories": [
      { "value": "Electrónica", "count": 13 },
      { "value": "Hogar y Muebles", "count": 11 },
      { "value": "Moda", "count": 11 },
      { "value": "Deporte y Fitness", "count": 10 },
      { "value": "Libros", "count": 8 }
    ],
    "subcategories": [
      { "value": "Portátiles", "count": 5 },
      { "value": "Auriculares", "count": 4 },
      { "value": "Smartphones", "count": 4 }
    ],
    "locations": [
      { "value": "Madrid", "count": 4 },
      { "value": "Barcelona", "count": 3 },
      { "value": "Sevilla", "count": 3 },
      { "value": "Valencia", "count": 3 }
    ],
    "price": { "min": 39.99, "max": 1449, "avg": 694.8 }
  },
  "suggestions": {
    "didYouMean": [],
    "related": ["Portátiles", "Auriculares", "Smartphones"]
  }
}
```

(`results` trimmed to one entry above for brevity — the real response returns `limit` items.) `subcategories`, `locations` and `price` inside `facets` **are** scoped to the active `category` filter (they answer "what else is available given Electrónica is selected"); only a facet's own dimension (`categories`, here) ignores its own filter, which is what keeps its sibling options visible. `suggestions.related` comes from a `significant_terms` aggregation and surfaces subcategories disproportionately concentrated in the current result set — here, all three Electrónica subcategories, since none of them appear anywhere else in the catalog.

With a free-text `q`, results additionally carry a non-null `score`, and `suggestions.didYouMean` fills in when the query looks like a typo (e.g. `q=lapto` → `["laptop"]`) — the phrase suggester only returns corrections that would actually match a real document.

### `GET /api/v1/products/autocomplete`

| Param | Type | Notes |
|---|---|---|
| `q` | string | Required, 1–100 chars, trimmed. Prefixes shorter than 2 characters short-circuit to an empty result without querying Elasticsearch. |
| `limit` | integer, 1–20 | Default `10`. |

Real response, captured against the seeded dataset:

```
GET /api/v1/products/autocomplete?q=lap&limit=5
```

```json
{
  "query": "lap",
  "suggestions": [
    { "text": "Laptop Asus ZenBook 14", "productId": "laptop-asus-zenbook-14" },
    { "text": "Laptop HP Pavilion 15", "productId": "laptop-hp-pavilion-15" },
    { "text": "Laptop Dell XPS 13", "productId": "laptop-dell-xps-13" },
    { "text": "Laptop Lenovo ThinkPad E14", "productId": "laptop-lenovo-thinkpad-e14" },
    { "text": "Laptop Apple MacBook Air M2", "productId": "laptop-apple-macbook-air-m2" }
  ],
  "cached": false
}
```

`cached` reflects whether the response was served from Redis; identical requests within the configured TTL return `cached: true` on subsequent hits.

### Errors

| Status | When | Example message |
|---|---|---|
| `400 Bad Request` | Failed `class-validator` validation: unknown query param, `minPrice > maxPrice`, out-of-range `page`/`limit`, pagination window exceeding Elasticsearch's `max_result_window`, etc. | `"minPrice (100) cannot be greater than maxPrice (10)"` |
| `503 Service Unavailable` | The `products` index doesn't exist yet (nobody ran `npm run seed`). | `"Product index 'products' does not exist. Run 'npm run seed' before searching."` |
| `503 Service Unavailable` | Elasticsearch is unreachable (connection refused, timeout). | `"Search backend is temporarily unavailable"` |

Any other, unexpected error falls through to Nest's default handler as a bare `500` — raw Elasticsearch/Redis errors never reach the client.

## Testing

```bash
npm run test        # unit tests — application/use cases with fake ports, no infrastructure needed
npm run test:e2e    # e2e tests — needs Docker running (docker-compose up -d elasticsearch redis)
npm run lint
```

`npm run test:e2e` seeds its own isolated index (`products-e2e-test`, separate from `products`) from a small deterministic fixture via a Jest `globalSetup`, and tears it down afterwards — it won't touch or depend on data from `npm run seed`.

## Environment variables

All variables are documented with their defaults in [`.env.example`](.env.example) — copy it to `.env` to override any of them locally. The ones worth calling out:

- `ELASTICSEARCH_PRODUCT_INDEX` — which index the API reads/writes. Change this (together with `ELASTICSEARCH_NODE`) if you're pointing at a non-default Elasticsearch setup.
- `SEARCH_CACHE_TTL_SECONDS` / `AUTOCOMPLETE_CACHE_TTL_SECONDS` — Redis cache TTLs, in seconds, for each endpoint. Setting either to `0` disables caching for that endpoint entirely (this is how the e2e test suite guarantees results can't leak between test runs via Redis).

## Development with Claude Code

This repository includes a [`CLAUDE.md`](CLAUDE.md) documenting the architecture, technical decisions, and conventions used throughout the project. It was used as working context with [Claude Code](https://claude.com/claude-code) as part of the development process, and is kept up to date alongside the code.

## License

Portfolio project — `UNLICENSED` (see `package.json`). Not intended for production use as-is.
