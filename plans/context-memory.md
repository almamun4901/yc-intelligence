# YC Intelligence Context Memory

This file is the working implementation memory for the repo. Update it as phases are completed so future work can start from this summary instead of rereading every plan file.

## Source Of Truth

- Product plan: `plans/implementation-plan.md`
- Technical plan: `plans/technical-plan.md`
- Implementation source of truth: `plans/technical-plan.md`

## Current Architecture

- Monorepo with pnpm workspaces and Turborepo.
- `packages/core` owns domain types, repositories, services, data pipeline, config, logging, and Prisma.
- `packages/mcp` is a thin MCP adapter over core services.
- `packages/api` is a thin Fastify REST adapter over core services.
- `packages/web` is the Next.js dashboard for company, job, founder, and HN activity exploration.
- Docker Compose provides local Postgres with pgvector and Redis.

## Current Working State

- Branch: `hn-activity-rest-api`.
- Phase 0 scaffold is present from `origin/main`.
- Project Memory Phase 1 was started from this context-memory plan and is now implemented and verified.
- `MemoryEntry` is exclusively for project-level decisions, notes, and research provenance.
- YC company intelligence data belongs in dedicated `Company`, `Founder`, `Job`, `HNPost`, and related models.
- Phase 2 has been started with the YC company fetch slice. Company rows can be populated from the live YC companies list endpoint; the current endpoint does not include founder data, so `Founder` remains schema/repository-ready but unpopulated by the current fetch path.
- Phase 3/4 company query vertical slice is implemented. Core now exposes `CompanyService`; MCP now registers `search_companies` and `get_company_detail` over that service.
- Phase 5 REST company API slice is implemented. API now exposes `/health`, `/companies`, and `/companies/:slug` over `CompanyService`, with Redis-backed best-effort caching for successful company GET responses.
- Job search foundation is implemented and live-smoke verified. Core now has `Job`, `CompanyJobSyncState`, `IJobRepository`, `PrismaJobRepository`, `JobService`, `extractTechStack`, `JobBoardFetcher`, and `pipeline:jobs`; API exposes `/jobs`; MCP registers `search_jobs`.
- HN activity is implemented across ingestion, REST, MCP, and dashboard. Core now has `HNPost`, `CompanyHNSyncState`, `IHNPostRepository`, `PrismaHNPostRepository`, `HNFetcher`, `HNService`, and `pipeline:hn`; MCP registers `get_hn_activity`; API exposes `/hn-activity`; the dashboard has a first-class HN Activity view; company detail includes recent/top HN posts when an HN repository is injected.
- HN relevance scoring is implemented. `HNPost` stores `relevanceScore` and `matchReasons`; `HNFetcher` scores domain, `Show HN`/`Launch HN` title, exact title alias, URL slug, and story text signals; broad/generic names require stricter evidence. API/MCP return score/reasons, and the dashboard displays relevance.
- GitHub ingestion is intentionally deferred for now because most YC companies do not expose public repos, matching is noisy, and public GitHub signals should not be treated as canonical internal tech stack data.
- Semantic search company vertical slice is implemented, unit-tested, and live-smoke verified. Core now has company search documents, Voyage embedding provider, `CompanyEmbedding`, `ICompanyEmbeddingRepository`, `PrismaCompanyEmbeddingRepository`, `EmbeddingService`, `pipeline:embeddings`, MCP `semantic_search`, REST `GET /search/semantic`, and `smoke:semantic`.
- MCP project memory tools are implemented and unit-tested. `packages/mcp` now registers `add_memory`, `search_memory`, and `supersede_memory` over `MemoryService`, with the production server wired to `PrismaMemoryRepository`.
- P0 demo credibility gate: jobs must remain nonzero and representative before launch. As of 2026-05-31, bounded active-company job ingestion restored a real local jobs corpus with 136 active jobs, including current Greenhouse rows for Gusto and Amplitude.
- Launch readiness now has a concrete checklist in `plans/launch-checklist.md`. Next work should prioritize that checklist, especially fresh demo-gate verification, Claude MCP acceptance, DB-backed CI, job result company context, and repo polish.

## Phase Checklist

### Phase 0: Repository & Environment

- [x] Initialize pnpm/Turborepo monorepo.
- [x] Add shared TypeScript config and package scripts.
- [x] Scaffold `packages/core`, `packages/mcp`, `packages/api`, and `packages/web`.
- [x] Add Docker Compose for Postgres + pgvector + Redis.
- [x] Add root `.env.example`.
- [x] Add Zod config validation in core.
- [x] Add structured Pino logger in core.
- [x] Verify install/build/type-check/lint.

Status: complete as of 2026-05-23.

### Phase 1: Project Memory Database & Domain Layer

- [x] Define pure project memory domain types.
- [x] Add Prisma schema and migration for `MemoryEntry`, `MemorySource`, and `RefreshLog`.
- [x] Add memory repository interface.
- [x] Add Prisma memory repository implementation.
- [x] Add memory service with active-by-default search, source excerpt capping, and bidirectional supersession.
- [x] Add repository and service tests.

Status: complete as of 2026-05-23. This was the first implementation phase started from the context-memory plan. Verification passed with:

- `pnpm --filter @yc-intelligence/core prisma:generate`
- `DATABASE_URL=postgresql://yc_user:yc_password@localhost:5433/yc_intelligence pnpm --filter @yc-intelligence/core exec prisma validate`
- `pnpm --filter @yc-intelligence/core typecheck`
- `pnpm --filter @yc-intelligence/core build`
- `pnpm --filter @yc-intelligence/core test`
- `pnpm typecheck`
- `pnpm test`

### Phase 2: Data Pipeline

- [x] Add HTTP client with retry/rate limiting.
- [x] Add YC fetcher and transformer.
- [x] Add job board fetcher.
- [x] Add tech stack extractor.
- [x] Add HN fetcher.
- [ ] Add GitHub fetcher.
- [x] Add pipeline orchestrator, CLI, and scheduler.

#### Phase 2 YC Company Fetch Slice

- [x] Add `Company` and `Founder` domain types.
- [x] Add Prisma schema and migration for `Company` and `Founder`.
- [x] Add company, founder, and refresh-log repository interfaces.
- [x] Add Prisma company, founder, and refresh-log repository implementations.
- [x] Add YC transformer with normalization for live YC company payloads and founder payloads when present.
- [x] Add YC fetcher with page/limit pagination, company/founder upserts, and refresh logging.
- [x] Add `pipeline:companies` script for running this slice.
- [x] Add transformer, fetcher, and opt-in repository integration tests.
- [x] Patch transformer compatibility for live YC camelCase fields: `oneLiner`, `longDescription`, `teamSize`, `isHiring`, `locations`, and `industries`.

Status: complete as of 2026-05-23. Verification passed with:

- `pnpm --filter @yc-intelligence/core prisma:generate`
- `DATABASE_URL=postgresql://yc_user:yc_password@localhost:5433/yc_intelligence pnpm --filter @yc-intelligence/core exec prisma validate`
- `pnpm --filter @yc-intelligence/core typecheck`
- `pnpm --filter @yc-intelligence/core test`
- `pnpm --filter @yc-intelligence/core build`
- `pnpm --filter @yc-intelligence/core lint`
- `pnpm typecheck`
- `pnpm test`

Manual local smoke verification also passed:

- `pnpm --filter @yc-intelligence/core exec prisma db push`
- `pnpm --filter @yc-intelligence/core build`
- A one-off Node script fetched `https://api.ycombinator.com/v0.1/companies?page=1&limit=100` and upserted the returned first page.
- The live API returned 25 companies for that request.
- Local Postgres contained 25 companies and 0 founders after the smoke run.
- Rerunning the one-off script updated rows by `slug` rather than duplicating them.
- `shortDescription`, `description`, `teamSize`, and `location` were populated after the transformer compatibility patch.

Full `pipeline:companies` live ingestion and opt-in Prisma integration tests were not run after this manual smoke verification. The current YC list endpoint response inspected during testing does not include `founders`, so founder ingestion requires a later source or endpoint decision.

#### Phase 2 Pipeline Orchestration/Scheduler Slice

- [x] Add `PipelineOrchestrator` that runs companies, jobs, HN, and embeddings in dependency order.
- [x] Add `pipeline:seed` and `pipeline:refresh` scripts over the orchestrator while preserving individual slice scripts.
- [x] Add `PIPELINE_STAGES` for selected stage runs, e.g. `PIPELINE_STAGES=jobs,hn`.
- [x] Add `PIPELINE_RESUME_FROM` for manual resume after a failed stage, e.g. `PIPELINE_RESUME_FROM=hn`.
- [x] Add `PipelineScheduler` using `node-cron`, with overlap protection for long-running refreshes.
- [x] Add `pipeline:schedule` script with `PIPELINE_SCHEDULE_CRON`, `PIPELINE_SCHEDULE_MODE`, and `PIPELINE_RUN_ON_START` controls.
- [x] Add unit coverage for stage ordering, selected stages, resume behavior, failure stop behavior, and env option parsing.

Status: implementation complete as of 2026-05-25. Verification passed with:

- `pnpm --filter @yc-intelligence/core typecheck`
- `pnpm --filter @yc-intelligence/core lint`
- `pnpm --filter @yc-intelligence/core test`
- `pnpm --filter @yc-intelligence/core build`
- `PIPELINE_STAGES=embeddings EMBEDDING_PIPELINE_LIMIT=1 pnpm --filter @yc-intelligence/core pipeline:refresh`, which completed with `{"processed":1,"generated":0,"skipped":1}` for the orchestrated embeddings stage.

Usage notes:

- `pnpm --filter @yc-intelligence/core pipeline:seed` and `pipeline:refresh` both run `companies -> founders -> jobs -> hn -> embeddings` by default.
- For safer incremental/live runs, combine stage selection and existing limits, e.g. `PIPELINE_STAGES=hn,embeddings HN_PIPELINE_LIMIT=25 EMBEDDING_PIPELINE_LIMIT=25 pnpm --filter @yc-intelligence/core pipeline:refresh`.
- If a run fails after a successful earlier stage, rerun with `PIPELINE_RESUME_FROM=<stage>` to continue from the failed stage within the selected stage list.

### Phase 3: Service Layer

- [x] Add project memory service.
- [x] Add company service.
- [x] Add job service.
- [x] Add HN service.
- [x] Add founder service.
- [x] Add embedding service.
- [x] Keep business logic out of adapters.

#### Semantic Search Work Plan

Goal: implement semantic search incrementally as a company-discovery layer, not as a replacement for exact facts such as hiring status, batch, status, location, or tags.

Recommended first slice: company-level semantic search over a generated company search document composed from structured company fields plus recent job and HN signals. Defer job-level, founder-level, memory-level, and README/GitHub embeddings until the company slice is proven useful.

- [x] Define `CompanyEmbedding` domain model for one current embedding per company.
- [x] Add Prisma schema/migration for company embeddings using `pgvector`, including company relation, source text hash, embedding model name, embedding vector, and timestamps.
- [x] Add repository interface and Prisma implementation for upserting embeddings, finding current company embeddings, and vector similarity search with optional structured filters.
- [x] Add search-document builder that creates concise, deterministic text from company name, batch, tags, descriptions, location, hiring flag, recent job titles/tech stacks, and recent HN titles.
- [x] Add embedding provider wrapper around Voyage embeddings using `VOYAGE_API_KEY` and `voyage-3.5`.
- [x] Add `EmbeddingService` to generate/update company embeddings idempotently, skip unchanged documents by hash, and run in limited batches.
- [x] Add `pipeline:embeddings` CLI command with environment knobs for limit, offset, and stale-only mode.
- [x] Add semantic search service method that embeds the user query, runs vector search, returns ranked company summaries with similarity scores, and preserves exact filters for `batch`, `status`, `industry`, `isHiring`, `limit`, and `offset`.
- [x] Register MCP `semantic_search` as a thin adapter over the core service.
- [x] Add REST `GET /search/semantic`.
- [x] Add unit tests for document construction, stale detection/hash behavior, search parameter normalization, and MCP schema/handler behavior.
- [x] Add opt-in Prisma integration coverage for vector storage/search once the migration exists.
- [x] Live-smoke verify against local Postgres with a small company batch, then record the verification commands and results here.

Status: company-level semantic search vertical slice implemented as of 2026-05-24. Verification passed with:

- `pnpm --filter @yc-intelligence/core prisma:generate`
- `pnpm --filter @yc-intelligence/core exec prisma validate`
- `pnpm --filter @yc-intelligence/core typecheck`
- `pnpm --filter @yc-intelligence/core test`
- `pnpm --filter @yc-intelligence/core build`
- `pnpm --filter @yc-intelligence/core lint`
- `pnpm --filter @yc-intelligence/core exec prisma migrate deploy` against local Postgres, run with escalation because Prisma needs access to its local engine/cache path
- `RUN_DB_TESTS=1 pnpm --filter @yc-intelligence/core test` against local Postgres, run with escalation because sandboxed tests cannot reach `localhost:5433`
- `pnpm --filter @yc-intelligence/mcp typecheck`
- `pnpm --filter @yc-intelligence/mcp test`
- `pnpm --filter @yc-intelligence/mcp build`
- `pnpm --filter @yc-intelligence/mcp lint`
- `pnpm --filter @yc-intelligence/api typecheck`
- `pnpm --filter @yc-intelligence/api test`
- `pnpm --filter @yc-intelligence/api build`
- `pnpm --filter @yc-intelligence/api lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm lint`

Semantic smoke follow-up on 2026-05-24:

- Added `pnpm --filter @yc-intelligence/core smoke:semantic` as a one-command live smoke path for semantic search. It refreshes a small embedding batch with the production `EmbeddingService`, then runs a semantic query through the same service against local Postgres/pgvector.
- `docker compose ps` confirmed local Postgres and Redis were healthy.
- `pnpm --filter @yc-intelligence/core exec prisma migrate status` confirmed all 5 migrations were applied.
- Local database baseline before the smoke attempt was 5,942 companies and 6 company embeddings.
- `EMBEDDING_PIPELINE_LIMIT=5 pnpm --filter @yc-intelligence/core pipeline:embeddings` reached the previous embeddings API path but failed with HTTP 401.
- `pnpm --filter @yc-intelligence/core smoke:semantic` also reached the live embeddings path and failed clearly because the embeddings key was invalid.
- The initial semantic live smoke was blocked on an invalid/missing `VOYAGE_API_KEY`; after the key was updated, the smoke passed as recorded below.
- On 2026-05-25 the embedding provider was switched from the previous provider to Voyage because the project will use Anthropic for Claude features and Anthropic does not provide a native embeddings model. A migration clears incompatible existing embeddings and changes `company_embeddings.embedding` to `vector(1024)` for `voyage-3.5`.
- Semantic smoke passed on 2026-05-25 after adding a valid `VOYAGE_API_KEY` and syncing the package-level `.env`. `SEMANTIC_SMOKE_LIMIT=1 pnpm --filter @yc-intelligence/core smoke:semantic` returned `ok: true` for query `AI infrastructure for developers`, with `refresh: {"processed":1,"generated":0,"skipped":1}` and `search: {"total":3,"count":3}`. Local Postgres contained 3 `company_embeddings` rows after the smoke.

Brutal testing follow-up on 2026-05-24:

- `docker compose ps` confirmed local Postgres and Redis were healthy.
- `pnpm --filter @yc-intelligence/core exec prisma migrate status` confirmed all 5 migrations were applied.
- `RUN_DB_TESTS=1 pnpm --filter @yc-intelligence/core test` initially exposed non-repeatable integration tests because broad filters like `W24` and `Developer Tools` matched rows left by previous runs.
- `PrismaCompanyEmbeddingRepository.test.ts` and `PrismaJobRepository.test.ts` now use unique batch/tag values per run, and the DB integration suite passes repeatedly.
- Final verification after the fix passed with `RUN_DB_TESTS=1 pnpm --filter @yc-intelligence/core test`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm lint`.

Implementation note: `PrismaCompanyEmbeddingRepository` uses raw SQL for `pgvector` insert/search because Prisma's normal model CRUD does not directly support vector operations. The embedding vector dimension is fixed at 1024 for `voyage-3.5`.

Semantic search usage notes:

- Use semantic search for fuzzy discovery queries such as "AI infrastructure for enterprise developers" or "boring workflow automation for finance teams."
- Continue using structured company/job filters for factual constraints such as active status, hiring, batch, exact industry tags, and location.
- Do not infer private tech stack from semantic matches; job postings remain the stronger source for technology signals.

### Phase 4: MCP Package

- [x] Scaffold MCP server.
- [x] Register `search_companies`.
- [x] Register `get_company_detail`.
- [x] Register `search_jobs`.
- [x] Register `get_hn_activity`.
- [x] Register `search_founders`.
- [x] Register `semantic_search`.
- [x] Register memory tools: `add_memory`, `search_memory`, and `supersede_memory`.

#### Phase 3/4 Company Query Vertical Slice

- [x] Add `CompanyService` with normalized search defaults and slug-based detail lookup.
- [x] Include founders in company detail responses when founder rows exist.
- [x] Export company service from core.
- [x] Wire MCP stdio server composition root over Prisma-backed repositories.
- [x] Add MCP `search_companies` and `get_company_detail` tools.
- [x] Add core service tests and lightweight MCP handler/schema tests.

Status: complete as of 2026-05-23. Verification passed with:

- `pnpm --filter @yc-intelligence/core typecheck`
- `pnpm --filter @yc-intelligence/core test`
- `pnpm --filter @yc-intelligence/mcp typecheck`
- `pnpm --filter @yc-intelligence/mcp build`
- `pnpm typecheck`
- `pnpm test`

Implementation note: MCP SDK and Prisma runtime classes are loaded dynamically in the MCP composition root to keep TypeScript declaration checking tractable under the current CommonJS package setup. Business logic still lives in core, and MCP handlers remain thin service adapters.

#### Phase 4 MCP Memory Tools Slice

- [x] Add `memoryTools.ts` as a thin MCP adapter over `MemoryService`.
- [x] Register `add_memory`, `search_memory`, and `supersede_memory`.
- [x] Wire production MCP composition root to `MemoryService` and `PrismaMemoryRepository`.
- [x] Export memory tools from the MCP package entrypoint.
- [x] Add schema and handler tests for add/search/supersede behavior.

Status: complete as of 2026-05-31. Verification passed with:

- `pnpm --filter @yc-intelligence/mcp typecheck`
- `pnpm --filter @yc-intelligence/mcp test`
- `pnpm --filter @yc-intelligence/mcp build`
- `pnpm --filter @yc-intelligence/mcp lint`

### Phase 5: REST API Package

- [x] Scaffold Fastify server and `/health`.
- [x] Add company routes.
- [x] Add job routes.
- [x] Add Redis caching middleware for company GET routes.

#### Phase 5 REST Company API Slice

- [x] Wire API production composition root over Prisma-backed company/founder repositories and `CompanyService`.
- [x] Add `GET /companies` with filters for `query`, `batch`, `status`, `industry`, `isHiring`, `limit`, and `offset`.
- [x] Add `GET /companies/:slug` with founder data when founder rows exist.
- [x] Add request validation and 404 handling for missing company details.
- [x] Add best-effort Redis response caching for successful company GET responses, with uncached fallback when Redis is unavailable.
- [x] Add Fastify injection tests for health, search, validation, detail lookup, missing detail, cache hits, and cache failures.

Status: REST API company and job search slices complete as of 2026-05-24.

#### Job Search Foundation Slice

- [x] Add `Job` domain type, `JobSearchParams`, Prisma `Job` model, and job migration.
- [x] Add `IJobRepository` and `PrismaJobRepository` with search, upsert, and inactive-marking behavior.
- [x] Add `JobService` with normalized active-by-default search.
- [x] Add `extractTechStack` with alias normalization for job descriptions.
- [x] Add `JobBoardFetcher` for Greenhouse, Lever, and Ashby, plus `pipeline:jobs`.
- [x] Add `GET /jobs` REST route.
- [x] Add MCP `search_jobs` tool.
- [x] Add unit tests and opt-in Prisma repository integration coverage.

Status: implementation complete and live-smoke verified as of 2026-05-24.

Live smoke verification notes:

- Local Docker Postgres and Redis were healthy.
- Local database had 5,930 companies before job smoke verification.
- An initial unbounded `pnpm --filter @yc-intelligence/core pipeline:jobs` run was stopped with `SIGINT` after roughly 21 minutes because expected missing ATS boards produced excessive info/warn logging and made the run hard to monitor.
- The smoke run still populated the local database to 6,147 active jobs: 4,963 Greenhouse jobs and 1,184 Lever jobs. No Ashby jobs were present in the resulting corpus.
- `JobBoardFetcher` now logs expected ATS 401/404 board misses at debug level, HTTP request logs are debug-level, and the fetcher logs start/progress/summary at info level.
- `JOB_PIPELINE_LIMIT=50 pnpm --filter @yc-intelligence/core pipeline:jobs` completed successfully with `{"processed":50,"jobsFound":0,"errors":0}` and no log flood.
- REST `GET /jobs?limit=3` returned HTTP 200 with `total: 6147`.
- MCP `search_jobs` over Prisma-backed `JobService` returned `total: 6147`.
- Full unbounded ingestion should be rerun after adding stronger progress/resume controls or a known ATS slug mapping layer; job search is usable against the current local corpus, but full-refresh runtime remains a pipeline scalability concern.

Hardening follow-up on 2026-05-25:

- Added `CompanyJobSyncState` with per-company job refresh outcomes, cached `lastAtsSource`, failure counts, and last error/status fields.
- `JobBoardFetcher` now tries a cached ATS source first, records `found_jobs`, `zero_jobs`, `no_supported_board`, and `transient_failure` outcomes, marks stale jobs inactive only when a supported board returns successfully, and returns a more explicit summary with total/offset/limit, companies with jobs, zero-job boards, unsupported boards, transient failures, upserted jobs, and inactive-marked counts.
- Added `JOB_PIPELINE_OFFSET` alongside `JOB_PIPELINE_LIMIT` for bounded job ingestion windows such as `0-500`, `500-1000`, etc.
- Verification passed with `pnpm --filter @yc-intelligence/core prisma:generate`, `pnpm --filter @yc-intelligence/core exec prisma validate`, `pnpm --filter @yc-intelligence/core typecheck`, `pnpm --filter @yc-intelligence/core test`, `pnpm --filter @yc-intelligence/core build`, `pnpm --filter @yc-intelligence/core lint`, `RUN_DB_TESTS=1 pnpm --filter @yc-intelligence/core test`, `pnpm typecheck`, `pnpm test`, and `pnpm lint`.
- Local migration deploy applied `20260525120000_job_ingestion_hardening` successfully.
- Bounded live smoke passed with `JOB_PIPELINE_LIMIT=5 JOB_PIPELINE_OFFSET=0 pnpm --filter @yc-intelligence/core pipeline:jobs`, returning `{"totalCompanies":4128,"offset":0,"limit":5,"processed":5,"jobsFound":0,"jobsUpserted":0,"companiesWithJobs":0,"companiesWithZeroJobs":0,"companiesWithoutSupportedBoard":5,"transientFailures":0,"parserFailures":0,"inactiveMarked":0,"errors":0}` in about 2 seconds.
- Adjacent offset smoke passed with `JOB_PIPELINE_LIMIT=5 JOB_PIPELINE_OFFSET=5 pnpm --filter @yc-intelligence/core pipeline:jobs`, returning the same clean no-board summary for the next five companies in about 2 seconds.

P0 demo credibility restoration on 2026-05-31:

- Baseline local database had only 1 active job, from the `Job Repo Co` integration-test fixture, so jobs were not representative enough for launch.
- Reran bounded job ingestion against active companies with `JOB_PIPELINE_LIMIT=15 JOB_PIPELINE_OFFSET=1898 pnpm --filter @yc-intelligence/core pipeline:jobs`.
- The run completed successfully with `{"totalCompanies":4121,"offset":1898,"limit":15,"processed":15,"jobsFound":135,"jobsUpserted":135,"companiesWithJobs":2,"companiesWithZeroJobs":0,"companiesWithoutSupportedBoard":13,"transientFailures":0,"parserFailures":0,"inactiveMarked":0,"errors":0}`.
- Post-run local database had 136 active jobs: 84 for Gusto, 51 for Amplitude, and 1 remaining fixture job.
- REST verification passed: `GET /jobs?limit=5` returned HTTP 200 with `total: 136` and real Greenhouse rows such as Amplitude `Enterprise Account Executive` and Gusto `Senior Manager, Growth Data Science`.
- MCP verification passed through the MCP protocol against the production Prisma-backed server: `search_jobs` with `{ "limit": 5 }` returned `total: 136` and real Greenhouse apply URLs.
- Dashboard verification passed in the Next.js Jobs view at `http://localhost:3002`: the UI showed `Open jobs: 136`, `136 results`, and visible Amplitude/Gusto rows with Greenhouse apply links.
- Do not move to launch unless `/jobs`, MCP `search_jobs`, and the dashboard Jobs view continue to return nonzero, representative rows from the current local or production database.

#### HN Ingestion Slice

- [x] Add `HNPost` and `CompanyHNSyncState` Prisma models and migration.
- [x] Add `HNPost` domain type and HN search params.
- [x] Add `IHNPostRepository` and `PrismaHNPostRepository` with upsert, search, and per-company sync state support.
- [x] Add `HNFetcher` over HN Algolia `search_by_date` with per-company checkpoint windows, query variants, objectID dedupe, post-type classification, and per-company failure recording.
- [x] Add `HNService` with normalized `searchHNActivity`.
- [x] Add `pipeline:hn` script with `HN_PIPELINE_LIMIT`, `HN_LOOKBACK_DAYS`, and `HN_MAX_PAGES_PER_COMPANY`.
- [x] Add MCP `get_hn_activity`.
- [x] Add HN post summaries to company detail when an HN repository is injected.
- [x] Add unit tests, MCP adapter tests, and opt-in Prisma repository integration coverage.
- [x] Add REST `/hn-activity`.
- [x] Add dashboard HN Activity view with filters and relevance display.
- [x] Add scored HN relevance metadata (`relevanceScore`, `matchReasons`) and stricter matching for broad/generic company names.

Status: implementation complete and live-smoke verified as of 2026-05-31.

Live smoke verification notes:

- `DATABASE_URL=postgresql://yc_user:yc_password@localhost:5433/yc_intelligence pnpm --filter @yc-intelligence/core exec prisma migrate deploy` applied `20260524090000_hn_ingestion`.
- `HN_PIPELINE_LIMIT=25 DATABASE_URL=postgresql://yc_user:yc_password@localhost:5433/yc_intelligence pnpm --filter @yc-intelligence/core pipeline:hn` completed with `{"processed":25,"postsFound":241,"postsUpserted":241,"errors":0}`.
- Post-smoke local database had 235 unique `HNPost` rows and 25 `CompanyHNSyncState` rows.
- MCP `get_hn_activity` handler over Prisma-backed `HNService` returned HN posts successfully.
- `HN_PIPELINE_LIMIT=250 HN_LOOKBACK_DAYS=3650 HN_MAX_PAGES_PER_COMPANY=2 DATABASE_URL=postgresql://yc_user:yc_password@localhost:5433/yc_intelligence pnpm --filter @yc-intelligence/core pipeline:hn` completed on 2026-05-31 with `{"processed":250,"postsFound":1674,"postsUpserted":1674,"errors":0}` after the relevance scorer was added.
- Post-scored-backfill local database had 1,673 unique `HNPost` rows and 250 `CompanyHNSyncState` rows. Score range was 45-255, average score 107.71.
- API and web proxy returned scored HN activity successfully: `/hn-activity?limit=1` and `/api/hn-activity?limit=1` included `relevanceScore` and `matchReasons`.
- Prisma `migrate deploy` currently fails locally with a vague schema-engine error, so `20260531160000_hn_relevance_scoring` was applied to the local Docker DB with `psql`; the migration file is committed for normal deploy paths.
- HN matching is materially better after relevance scoring, but generic company names can still need company-specific alias/ignore rules for best precision.

### Phase 6: Testing

- [x] Add project memory unit tests.
- [x] Add opt-in project memory integration tests.
- [x] Add MCP E2E tests.
- [ ] Run manual Claude acceptance queries. Claude is the target MCP client for acceptance testing and demo workflows.

#### Phase 6 MCP E2E And Claude Acceptance

- [x] Add protocol-level MCP E2E coverage using the official SDK `Client` and `InMemoryTransport`.
- [x] Verify all registered tools are listed by the MCP client: `search_companies`, `get_company_detail`, `search_jobs`, `get_hn_activity`, `semantic_search`, `search_founders`, `add_memory`, `search_memory`, and `supersede_memory`.
- [x] Verify every registered tool can be called through the MCP client against deterministic fixture-backed services.
- [x] Verify unknown company detail returns a graceful not-found payload through the MCP protocol.
- [ ] Complete the 10-query manual Claude acceptance suite against production MCP data.

Status: MCP E2E complete as of 2026-05-31. Verification passed with:

- `pnpm --filter @yc-intelligence/mcp typecheck`
- `pnpm --filter @yc-intelligence/mcp test`
- `pnpm --filter @yc-intelligence/mcp build`

Manual Claude acceptance attempt on 2026-05-31:

- `claude` was installed at `/Users/malm/.local/bin/claude`.
- A non-interactive Claude Code probe was run with `--strict-mcp-config` pointing at `packages/mcp/dist/index.js`.
- The probe did not reach MCP acceptance because Claude auth failed first with `apiKeyHelper failed: exited 44` and keychain lookup errors.
- `ANTHROPIC_API_KEY` was not present in the shell environment.
- Docker was also unavailable from this session (`Cannot connect to the Docker daemon...`), so production MCP data-backed acceptance would still need local Postgres/Redis or another reachable `DATABASE_URL` after Claude auth is fixed.
- To finish manual acceptance, authenticate Claude Code or export `ANTHROPIC_API_KEY`, start local services or point `DATABASE_URL` at a populated database, run `pnpm --filter @yc-intelligence/mcp build`, then execute the 10 acceptance queries from `plans/implementation-plan.md`.

### Phase 7: CI/CD & Launch

- [x] Add GitHub Actions CI.
- [x] Refresh README around the current MCP + REST + dashboard product.
- [x] Prepare launch checklist.
- [ ] Add license and final repo polish.
- [ ] Complete launch checklist.

Status: baseline CI added as of 2026-05-25. README refresh and launch checklist were completed on 2026-06-28. The workflow runs on PRs and pushes to `main`, sets up Node 20 and pnpm 10.30.1, installs with the lockfile, generates the Prisma client, then runs `pnpm typecheck`, package test suites sequentially, `pnpm build`, and `pnpm lint`. It intentionally does not run `RUN_DB_TESTS=1` or start Postgres/Redis services yet; DB-backed CI should be a follow-up once the lightweight gate is stable.

## Decisions Locked In

- Use the technical plan's monorepo, not the older single-package layout from the product plan.
- Use Node.js 20+, TypeScript strict mode, pnpm, Turbo, Prisma, Postgres + pgvector, Redis, Zod, Pino, Vitest.
- Do not scrape LinkedIn; founder background fields remain empty unless available from permitted sources.
- Core must not import MCP or API. MCP and API may import core.
- Keep project memory separate from YC company intelligence data.
- Treat context memory as the rolling implementation handoff: update this file after each completed phase before starting the next one.
