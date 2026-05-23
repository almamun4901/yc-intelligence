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
- Project Memory Phase 1 is implemented locally and verified.
- `MemoryEntry` is exclusively for project-level decisions, notes, and research provenance.
- YC company intelligence data belongs in future `Company`, `Job`, `Founder`, `HNPost`, and related models.

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

Status: complete as of 2026-05-23. Verification passed with:

- `pnpm --filter @yc-intelligence/core prisma:generate`
- `DATABASE_URL=postgresql://yc_user:yc_password@localhost:5433/yc_intelligence pnpm --filter @yc-intelligence/core exec prisma validate`
- `pnpm --filter @yc-intelligence/core typecheck`
- `pnpm --filter @yc-intelligence/core build`
- `pnpm --filter @yc-intelligence/core test`
- `pnpm typecheck`
- `pnpm test`

### Phase 2: Data Pipeline

- [x] Add HTTP client with retry/rate limiting.
- [ ] Add YC fetcher and transformer.
- [ ] Add job board fetcher.
- [ ] Add tech stack extractor.
- [ ] Add HN fetcher.
- [ ] Add GitHub fetcher.
- [ ] Add pipeline orchestrator, CLI, and scheduler.

### Phase 3: Service Layer

- [x] Add project memory service.
- [ ] Add company, job, founder, HN, and embedding services.
- [x] Keep business logic out of adapters.

### Phase 4: MCP Package

- [ ] Scaffold MCP server.
- [ ] Register `search_companies`.
- [ ] Register `get_company_detail`.
- [ ] Register `search_jobs`.
- [ ] Register `search_founders`.
- [ ] Register `get_hn_activity`.
- [ ] Register `semantic_search`.
- [ ] Register future memory tools such as `add_memory`, `search_memory`, and `supersede_memory`.

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
