# CLAUDE.md

Context guide for Claude Code in this repository. Read it in full before touching any code.

## Current state of the repo

Beyond the `nest new` scaffold (`src/app.*`, default `README.md`), the following exist:
- `docker-compose.yml` (API + Elasticsearch 9.4.4 + Redis, named `es-data` volume), `Dockerfile`, `.dockerignore`
- `src/health/` — a basic health check module/controller, registered in `AppModule`
- `src/product-search/infrastructure/elasticsearch/product-index.mapping.ts` — the product index's analysis settings and field mappings (autocomplete via edge n-grams with a separate index/search analyzer pair, keyword facets with a normalized sub-field, `scaled_float` price, trigram sub-field for did-you-mean), plus `product-index.constants.ts` (default index name) and a spec guarding the mapping's internal consistency (analyzer/normalizer references, price scaling factor)
- `data/products.json` — 53 fixture products across 5 categories × 3 subcategories each, 4 locations, wide price range, and `popularity`/`created_at` assigned so they're deliberately uncorrelated with each other and with price (so sorting by relevance/popularity/date visibly differs) — see generation notes below
- `scripts/seed.ts` (`npm run seed`) — deletes and recreates the `products` index from `PRODUCT_INDEX_SETTINGS`/`PRODUCT_INDEX_MAPPINGS`, then bulk-indexes `data/products.json` by `_id`. Idempotent by construction (delete-then-create, not upsert): running it twice always yields the same 53 documents, and it stays in sync automatically if the mapping changes later. Reads `ELASTICSEARCH_NODE` (fallback `http://localhost:9201`, matching docker-compose's host port mapping) and `ELASTICSEARCH_PRODUCT_INDEX` (fallback `PRODUCT_INDEX_DEFAULT_NAME`)
- `src/product-search/` — the full hexagonal module, wired into `AppModule` alongside `ConfigModule.forRoot({ isGlobal: true })`:
  - `domain/` — `Product` entity, `SearchCriteria`/`SearchResult`/`Facets`/`Suggestions`/`AutocompleteSuggestion`, value objects (`PriceRange`, `Pagination`, `SortCriteria`) enforcing invariants (min ≤ max price, pagination within ES's `max_result_window`), and domain errors (`InvalidSearchCriteriaError`, `SearchIndexNotFoundError`, `SearchUnavailableError`)
  - `application/` — `ProductSearchPort`/`ProductCachePort` interfaces, `SearchProductsUseCase`/`AutocompleteProductsUseCase` with Redis cache-aside (TTL `0` disables caching, used by e2e tests later)
  - `infrastructure/elasticsearch/` — `product-query.builder.ts` (pure `SearchCriteria` → ES request body: dual precise/fuzzy `multi_match`, `post_filter` + per-facet `filter` aggs for multi-select faceting, `significant_terms` for related terms, phrase suggester for did-you-mean), `product-search.mapper.ts` (pure ES response → domain, decoupled from the client's loose aggregation types), `elasticsearch-product-search.repository.ts` (the `ProductSearchPort` adapter; translates ES errors — `index_not_found_exception` → `SearchIndexNotFoundError`, connectivity errors → `SearchUnavailableError`, anything else — e.g. a `parsing_exception` from our own malformed query — rethrown as-is so it surfaces as a plain 500 instead of a misleading "backend down" 503)
  - `infrastructure/redis/` — `RedisProductCacheAdapter` (`ProductCachePort` adapter; never throws, degrades to "cache miss" on any Redis failure, `enableOfflineQueue: false` so a down Redis fails fast instead of hanging)
  - `presentation/` — `ProductSearchController` (`GET /api/v1/products/search`, `GET /api/v1/products/autocomplete`), DTOs with `class-validator` (`whitelist`/`forbidNonWhitelisted` globally in `main.ts` — an unknown query param is a 400, not silently ignored), mappers, and `ProductSearchExceptionFilter` (maps the three domain errors above to 400/503; anything else falls through to Nest's default 500 handler)
  - Unit tests (`*.spec.ts` beside each file) plus e2e tests — see below
- `src/bootstrap/configure-app.ts` — `configureApp(app)` (the `ValidationPipe` registration), shared between `main.ts` and the e2e test harness so both exercise identical validation behavior
- `.env.example` — documents `PORT`, `ELASTICSEARCH_NODE`, `ELASTICSEARCH_PRODUCT_INDEX`, `ELASTICSEARCH_REQUEST_TIMEOUT_MS`, `REDIS_HOST`, `REDIS_PORT`, `SEARCH_CACHE_TTL_SECONDS`, `AUTOCOMPLETE_CACHE_TTL_SECONDS`
- `test/product-search/` — e2e tests against a real Elasticsearch/Redis (`npm run test:e2e`), split by area: `search-by-field`, `search-combined-and-facets`, `search-sort-pagination`, `autocomplete`, `edge-cases` (empty search, zero results, out-of-range page, contradictory filters, pagination window exceeded, unseeded index via an overridden `PRODUCT_INDEX_NAME` provider). All seeded once via Jest `globalSetup`/`globalTeardown` (`test/product-search/support/`) into a dedicated `products-e2e-test` index — never `products` — from a small hand-authored fixture (`support/e2e-products.fixture.ts`, 9 products with independently-ranked price/popularity/date so sort assertions are unambiguous), completely separate from `data/products.json`. Cache TTLs are forced to `0` for the whole e2e run (`support/e2e-env.ts`) so responses can't leak between tests via Redis.
- `.github/workflows/ci.yml` — runs on every push/PR: checkout → install → Elasticsearch+Redis as service containers (health-checked, no fixed sleep) → `npm run seed` (smoke test of the real seed script, against its own `products` index) → lint → unit → e2e (seeds its own `products-e2e-test` index via the same `globalSetup`). **Verified against real GitHub Actions runs**, not just locally: the first push failed because the `grep`-based Elasticsearch healthcheck command didn't behave the same way inside the Actions runner's `docker exec` as it did locally; simplified to `curl -sSf '.../_cluster/health?wait_for_status=yellow&timeout=60s'` (commit "fix: simplify Elasticsearch service healthcheck in CI"), after which the workflow passed end-to-end.
- `README.md` — replaces the `nest new` scaffold: description, CI badge, architecture/stack rationale, install/run steps, full documentation of both endpoints (query params, real captured request/response examples, error table), testing, env vars, and a short note on `CLAUDE.md`/Claude Code usage. The `search` example response was captured live against the seeded dataset specifically to demonstrate multi-select faceting (`facets.categories` lists every category with its real count when filtered by one of them, not just the active selection).
- `postman/product-search-api.postman_collection.json` + `postman/product-search-api.postman_environment.json` — 4 folders (Health, Search, Autocomplete, Error cases), every request templated as `{{baseUrl}}/...` against the environment's `baseUrl` variable (default `http://localhost:3000`), no hardcoded URLs. Query values reuse the exact examples already captured in README.md where one exists (`q=laptop`, `q=lapto`, `category=Electrónica&limit=3`, `q=lap&limit=5`, the `minPrice=100&maxPrice=10` error); the combined-filters and sort=createdAt requests are new but use only real dataset values (`Electrónica`/`Madrid`/price band), verified live to return the counts described in each request's description. Deliberately excludes the nonexistent-index 503 case (needs the `PRODUCT_INDEX_NAME` override, not something a normal API consumer would do).

Still missing: an online deployment. Everything below this point describes the target design — don't assume a piece is implemented without checking. Update this section as pieces land.

## Regenerating `data/products.json`

The dataset isn't hand-typed line by line: names/descriptions/category/subcategories/location/price are authored per product (including deliberate near-duplicate name clusters like `Laptop *`, `Mesa *`, `Auriculares *`, `Zapatillas *` for autocomplete/fuzzy testing), but `popularity` and `created_at` are assigned via two independent coprime-step permutations over the product list — this is what keeps them uncorrelated with each other and with price (verified via Pearson correlation, all < 0.16 in absolute value) instead of just eyeballing a spread. There's no committed generator script for this — it was a disposable one-off. If the dataset needs to grow or be regenerated, reproduce that approach (hand-author the descriptive fields, permute `popularity`/`created_at` independently) rather than assigning them in list order, or sorting by any one field will accidentally correlate with the others.

## `package.json` `overrides` — brace-expansion exception

```json
"overrides": {
  "brace-expansion": "^5.0.8",
  "@eslint/eslintrc": {
    "minimatch": {
      "brace-expansion": "^1.1.12"
    }
  }
}
```

The global override pins `brace-expansion` to `^5.0.8`, patched against **GHSA-mh99-v99m-4gvg / CVE-2026-14257** (unbounded-length expansion → OOM crash). But `@eslint/eslintrc` depends on `minimatch@3.1.5`, which calls `require('brace-expansion')` expecting it to itself be the expand function (the pre-5.x API) — under `brace-expansion@5.x` that `require` instead returns `{ expand, EXPANSION_MAX, EXPANSION_MAX_LENGTH }`, so `expand(pattern)` throws `TypeError: expand is not a function` and `npm run lint` cannot run at all.

The scoped override forces just that one dependency path back to `^1.1.12`, which restores compatibility.

**Known residual risk, accepted deliberately:** `brace-expansion@1.1.12` (currently resolves to `1.1.16`) is patched against the older **GHSA-v6h2-p8h4-qcjw / CVE-2025-5889** (ReDoS), but its advisory range for CVE-2026-14257 is `<=5.0.7` with no stated backport to the 1.x/2.x/3.x/4.x lines — so this specific path (`@eslint/eslintrc > minimatch@3.1.5 > brace-expansion`) remains unpatched against CVE-2026-14257 until upstream backports a fix or `@eslint/eslintrc` moves off `minimatch@3.x`. Treated as low risk here because that `minimatch` instance only ever parses this project's own `eslint.config.mjs` glob patterns at dev/lint time — it never touches external or user-supplied input, and never runs in the production container (the `lint` script isn't part of the `Dockerfile` build). Re-evaluate if `@eslint/eslintrc` is ever exercised against untrusted input.

## What this project is

NestJS backend API for advanced product search. Origin: a technical challenge for a hiring process, but treated as a **professional portfolio project on GitHub** — technical decisions are made with long-term maintainability and quality in mind, not a submission deadline. There's no artificial time pressure: prioritize doing it well over doing it fast.

Project goal: performance, scalability, and clean code. **No front-end is required.**

A functional, well-documented submission is worth more than total completeness — get the core working end-to-end before covering 100% of the nice-to-haves, but don't trade quality for speed, since this is a public artifact.

## Functional scope

The API must allow searching for products by:
- Name
- Category
- Subcategories
- Location
- Price

Mandatory requirements:
- **Hexagonal architecture** (ports & adapters) — see the architecture section below
- **Autocomplete** using Elasticsearch + Redis (Redis for cache/speed, Elasticsearch as the source of suggestions)
- **Relevance-based ranking** of results (not just alphabetical/date order)
- **Alternative/related query suggestions**: generate suggestions for alternative or related queries, including spelling corrections (fuzzy matching / did-you-mean) and semantically related terms, using Elasticsearch's native capabilities (suggesters, fuzzy queries) over the indexed product information
- **Filtering & faceting**, combined and individual: categories, subcategories, location, price range
- **Pagination & multi-option sorting**: by relevance, popularity, created_at

## Hexagonal architecture — folder convention

Follow a feature-based pattern with ports and adapters explicitly separated:

```
src/
  <feature>/                    # e.g. product-search/
    domain/                     # entities, value objects, pure business rules
    application/                # use cases / application services, ports (interfaces)
      ports/                    # interfaces the domain needs (ISearchRepository, ICachePort, etc.)
    infrastructure/              # concrete adapters
      elasticsearch/             # Elasticsearch adapter implementing the search port
      redis/                     # Redis adapter implementing the cache port
    presentation/                # controllers, input/output DTOs, mappers
data/
  products.json                  # reproducible seed dataset, outside src/
```

Rules:
- `domain/` never imports anything from `infrastructure/` or from NestJS directly.
- Use cases depend on interfaces (`ports/`), never on concrete implementations — Nest's dependency injection resolves the binding at the module level.
- `presentation/` DTOs never leak into the domain; use explicit mappers.
- There is no `infrastructure/persistence/` folder because there's no relational database — see the storage decision below.

## Stack and technical decisions

- **NestJS** as the main framework (TypeScript)
- **Elasticsearch**: search engine, autocomplete, relevance, faceting/aggregations, **and queryable product storage** (see decision below)
- **Redis**: cache for autocomplete and frequent results/facets

### Decision: no relational database

The original challenge doesn't mention or require database persistence. Decision made: **no PostgreSQL/MySQL/SQL Server or any RDBMS**. Elasticsearch acts as the sole queryable storage for products — its indexing and search engine more than covers this domain's needs (search, filters, facets, ranking), and adding an RDBMS just for persistence would introduce an unnecessary synchronization layer (DB → index) for the scope of this project.

Direct consequence: there's no `infrastructure/persistence/` with a traditional database repository — the Elasticsearch adapter **is** the repository.

### Dataset and seeding

The API needs real products to search over. Flow:
- `data/products.json` at the repo root (outside `src/`): reproducible dataset with sample products (name, category, subcategories, location, price, popularity, created_at, and any field needed for ranking/facets).
- `npm run seed`: a script that must
  1. Create the Elasticsearch index if it doesn't exist
  2. Configure the mapping (correct field types: text with an autocomplete analyzer, keyword for facets, numeric range for price, date for created_at)
  3. Load the products from `products.json` (bulk insert)
  4. Leave Elasticsearch ready to receive searches

The seed must be idempotent: running it twice must not duplicate documents or fail if the index already exists (recreate it, or use bulk upsert by ID).

### Elasticsearch data persistence (Docker)

Even though the project doesn't use an RDBMS, the data indexed in Elasticsearch **must survive** a container restart or recreation — otherwise `npm run seed` would need to run every time `docker-compose` comes up, which isn't acceptable for a dev environment or for anyone cloning the repo.

- `docker-compose.yml` must declare a **named volume** (e.g. `es-data:`) mounted at Elasticsearch's data path (`/usr/share/elasticsearch/data`).
- The volume must be declared in the top-level `volumes:` section of the compose file, not as a bind mount to a repo folder (avoids polluting the working directory with container binary files).
- `docker-compose down` without `-v` must preserve the data; `docker-compose down -v` deletes it intentionally — document this in the README for anyone who wants a clean reset.
- Redis does **not** need a volume: its role here is cache (autocomplete, frequent results), not source of truth — losing it on restart is acceptable and expected, it rebuilds naturally through normal API usage.

- Input validation with `class-validator` / `class-transformer` on the DTOs
- Centralized error handling (Nest exception filters), never let raw Elasticsearch/Redis errors reach the client

## Testing and API integrity

The goal of the tests isn't coverage for its own sake, but guaranteeing that the public search endpoints behave correctly as the codebase changes. At minimum:

- **Unit tests**: `application/` use cases with the Elasticsearch/Redis adapters mocked (fake ports) — validate business rules (ranking, query building, facets) without depending on real infrastructure.
- **E2E tests**: against a real Elasticsearch/Redis instance (spun up in the pipeline, see CI below) — cover at least:
  - Search by name, category, subcategory, location, and price (individually)
  - Combined filters (2+ criteria at once) and faceting
  - Pagination and every sort mode (relevance, popularity, created_at)
  - Autocomplete / suggestions with an intentional typo (fuzzy matching)
  - Edge cases: empty search, no results, contradictory filters, out-of-range pagination
- E2E tests must be able to run against an index seeded with a small, deterministic subset of `products.json` (or a dedicated test fixture), not against random data — assertions need predictable results.

### CI with GitHub Actions

Create `.github/workflows/ci.yml` to run on every push and pull request:

1. Checkout the code and install dependencies (`npm ci`)
2. Spin up Elasticsearch and Redis as **service containers** for the job (not as an external dependency) so e2e tests run isolated and reproducible
3. Wait for Elasticsearch to be healthy before continuing (healthcheck, not a fixed `sleep`)
4. Run `npm run seed` (or the test fixture) against that ephemeral instance
5. `npm run lint`
6. `npm run test` (unit)
7. `npm run test:e2e`
8. Fail the workflow if any step fails, so a PR with a breaking change shows red before it can be merged

The pipeline must be self-sufficient: anyone opening a PR (including the author, months later) should be able to see if something broke without spinning anything up locally.

## Commands

- `npm run start:dev` — dev server with watch
- `npm run seed` — creates the index, configures the mapping, and loads `data/products.json` into Elasticsearch
- `npm run test` — unit tests
- `npm run test:e2e` — end-to-end tests
- `npm run lint` — lint (run this before considering any task done)
- `docker-compose up` — spins up API + Elasticsearch + Redis locally
- `npx jest <path-to-file>.spec.ts` — run a single unit test file (e.g. `npx jest src/product-search/application/search-products.usecase.spec.ts`)
- `npx jest --config ./test/jest-e2e.json <path-to-file>.e2e-spec.ts` — run a single e2e test file

(Update these commands to match reality once `package.json` is defined — this file must stay in sync with what actually exists in the repo.)

## Required deliverables (non-negotiable)

- [x] Well-structured Dockerfile + docker-compose.yml (multi-stage build in the Dockerfile; docker-compose only needs API + Elasticsearch + Redis, no database service)
- [x] README with installation instructions, how to run the project (including `npm run seed` as a required step before search works), and how to test the API
- [x] Postman collection with pre-configured endpoints, exported as `.json` in the repo
- [ ] Online deployment if feasible (Railway/Render/Fly.io are quick options for an Elasticsearch+Redis stack); otherwise, keep local Docker flawless
- [x] `.github/workflows/ci.yml` running lint + unit + e2e on every push/PR, with Elasticsearch and Redis as service containers — verified green on a real GitHub Actions run

## Code conventions

- Strict TypeScript (`strict: true` in `tsconfig.json`)
- kebab-case filenames, PascalCase classes, following standard Nest convention (`*.controller.ts`, `*.service.ts`, `*.module.ts`)
- Each Nest module exposes only what other modules need via `exports`
- Environment variables via `@nestjs/config`, never hardcoded — document all of them in `.env.example`
- Explicitly handle edge cases: empty search, no results, contradictory filters, out-of-range pagination, Elasticsearch/Redis down (clear fallback or error, no crash), un-seeded index (clear message, not a generic 500)

## What NOT to do

- Don't mix infrastructure logic (Elasticsearch queries, Redis commands) into controllers or the domain
- Don't commit `.env` with real credentials
- Don't leave stray `console.log`s — use Nest's Logger
- Don't introduce an RDBMS "just in case" — the decision to use Elasticsearch alone is deliberate, not a shortcut
