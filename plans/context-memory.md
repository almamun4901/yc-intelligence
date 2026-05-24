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
- `packages/web` is scaffold-only for future UI work.
- Docker Compose provides local Postgres with pgvector and Redis.

## Current Working State

- Branch: `project-memory-implementation`.
- Phase 0 scaffold is present from `origin/main`.
- Project Memory Phase 1 was started from this context-memory plan and is now implemented and verified.
- `MemoryEntry` is exclusively for project-level decisions, notes, and research provenance.
- YC company intelligence data belongs in dedicated `Company`, `Founder`, `Job`, `HNPost`, and related models.
- Phase 2 has been started with the YC company fetch slice. Company rows can be populated from the live YC companies list endpoint; the current endpoint does not include founder data, so `Founder` remains schema/repository-ready but unpopulated by the current fetch path.
- Phase 3/4 company query vertical slice is implemented. Core now exposes `CompanyService`; MCP now registers `search_companies` and `get_company_detail` over that service.
- Next implementation work should continue with either REST company routes, job/tech-stack ingestion, or MCP E2E/manual Claude acceptance testing, while preserving the project-memory boundary established in Phase 1.

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
- [ ] Add job board fetcher.
- [ ] Add tech stack extractor.
- [ ] Add HN fetcher.
- [ ] Add GitHub fetcher.
- [ ] Add pipeline orchestrator, CLI, and scheduler.

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

### Phase 3: Service Layer

- [x] Add project memory service.
- [x] Add company service.
- [ ] Add job, founder, HN, and embedding services.
- [x] Keep business logic out of adapters.

### Phase 4: MCP Package

- [x] Scaffold MCP server.
- [x] Register `search_companies`.
- [x] Register `get_company_detail`.
- [ ] Register `search_jobs`.
- [ ] Register `search_founders`.
- [ ] Register `get_hn_activity`.
- [ ] Register `semantic_search`.
- [ ] Register future memory tools such as `add_memory`, `search_memory`, and `supersede_memory`.

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

### Phase 5: REST API Package

- [ ] Scaffold Fastify server and `/health`.
- [ ] Add company and job routes.
- [ ] Add Redis caching middleware.

### Phase 6: Testing

- [x] Add project memory unit tests.
- [x] Add opt-in project memory integration tests.
- [ ] Add MCP E2E tests.
- [ ] Run manual Claude acceptance queries.

### Phase 7: CI/CD & Launch

- [ ] Add GitHub Actions CI.
- [ ] Add README, license, and repo polish.
- [ ] Prepare demo and launch checklist.

## Decisions Locked In

- Use the technical plan's monorepo, not the older single-package layout from the product plan.
- Use Node.js 20+, TypeScript strict mode, pnpm, Turbo, Prisma, Postgres + pgvector, Redis, Zod, Pino, Vitest.
- Do not scrape LinkedIn; founder background fields remain empty unless available from permitted sources.
- Core must not import MCP or API. MCP and API may import core.
- Keep project memory separate from YC company intelligence data.
- Treat context memory as the rolling implementation handoff: update this file after each completed phase before starting the next one.
