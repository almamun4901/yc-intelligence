# Launch Checklist

This checklist is the release gate for YC Company Intelligence. Do not launch from memory or vibes; update this file with dates, commands, and results as each item is verified.

## Launch Status

Current status: not ready to launch.

Last checklist refresh: 2026-06-28.

Latest demo-gate attempt: 2026-06-28, passed for requested surfaces.

Primary blockers:

- Manual Claude MCP acceptance is still incomplete.
- DB-backed CI is not yet running in GitHub Actions.
- License and final repo polish are not complete.

## Required Launch Gates

- [ ] Tracked working tree is clean except intentionally ignored/untracked local-only files.
- [ ] Latest branch is pushed to GitHub.
- [ ] CI is green on the launch PR or launch branch.
- [ ] Local services are healthy: Postgres with pgvector and Redis.
- [ ] Prisma migrations apply cleanly with `pnpm --filter @yc-intelligence/core exec prisma migrate deploy`.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm lint` passes.
- [ ] `RUN_DB_TESTS=1 pnpm --filter @yc-intelligence/core test` passes against local Postgres.
- [x] Semantic smoke returns `ok: true`.
- [x] Jobs demo gate is nonzero and representative across REST, MCP, and dashboard.
- [ ] HN activity demo gate returns scored, relevant rows across REST, MCP, and dashboard.
- [ ] Founder demo gate returns real founder rows across REST, MCP, and dashboard.
- [ ] Company detail demo gate shows company summary plus founder/HN detail where data exists.
- [ ] Manual Claude MCP acceptance suite passes against production MCP data.
- [ ] README accurately describes setup, tools, API routes, dashboard, pipeline, env vars, semantic smoke, and known limitations.
- [ ] Known data limitations are visible and honest.
- [ ] License is present.
- [ ] Demo script or launch notes are prepared.

## Verification Commands

Static and package checks:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Local services and migrations:

```bash
docker compose ps
pnpm --filter @yc-intelligence/core prisma:generate
pnpm --filter @yc-intelligence/core exec prisma migrate deploy
```

DB-backed core tests:

```bash
RUN_DB_TESTS=1 pnpm --filter @yc-intelligence/core test
```

Semantic smoke:

```bash
SEMANTIC_SMOKE_LIMIT=5 pnpm --filter @yc-intelligence/core smoke:semantic
```

API server:

```bash
pnpm --filter @yc-intelligence/api build
PORT=3001 node packages/api/dist/index.js
```

Dashboard:

```bash
pnpm --filter @yc-intelligence/web dev
```

Fallback dashboard port:

```bash
pnpm --dir packages/web exec next dev -p 3002
```

## Demo Data Gates

### Attempt Log

2026-06-28 demo-gate rerun attempt:

- Initial attempt was blocked because Docker was not running and `node_modules` had been emptied by a prior interrupted pnpm reinstall.
- Recovery completed with `CI=true pnpm install --frozen-lockfile`, approving required native build scripts in `pnpm-workspace.yaml`, and `pnpm rebuild @prisma/client @prisma/engines esbuild prisma sharp`.
- `docker compose up -d` restored local Postgres and Redis; `docker compose ps` showed both containers healthy.
- `CI=true pnpm build` passed from cache for core, API, MCP, and web.
- `CI=true pnpm --filter @yc-intelligence/core prisma:generate` passed after allowing Prisma to update its engine cache.
- Semantic smoke passed with `ok: true`, query `AI infrastructure for developers`, `refresh: {"processed":5,"generated":3,"skipped":2}`, and `search: {"total":2377,"count":5}`.
- Database counts: 136 active jobs, 1,674 HN posts, 11,224 founders.
- REST checks passed for `/jobs?limit=5`, `/hn-activity?limit=5&sort=signal`, `/founders?limit=5`, and `/search/semantic?query=developer%20tools%20for%20agents&limit=5`.
- MCP checks passed for `search_jobs`, `get_hn_activity`, `search_founders`, and `semantic_search`.
- Dashboard Jobs view passed in the in-app browser at `http://localhost:3002`: it showed `136 results`, `Enterprise Account Executive`, `Senior Manager, Growth Data Science`, and Greenhouse apply links.

### Jobs

Required result: nonzero, representative rows from real companies, not only test fixtures.

Previously restored with:

```bash
JOB_PIPELINE_LIMIT=15 JOB_PIPELINE_OFFSET=1898 pnpm --filter @yc-intelligence/core pipeline:jobs
```

Last recorded result on 2026-05-31:

- 136 active jobs.
- 84 Gusto jobs.
- 51 Amplitude jobs.
- REST `/jobs`, MCP `search_jobs`, and dashboard Jobs view all returned real rows.

Before launch, rerun and record:

- [x] Current active job count: 136 active jobs.
- [x] Top companies by active job count: Gusto 84, Amplitude 51, one remaining `Job Repo Co` fixture row.
- [x] REST `/jobs?limit=5` result: HTTP 200, `total: 136`, first row Amplitude `Enterprise Account Executive`, Greenhouse apply URL.
- [x] MCP `search_jobs` result: `total: 136`, first row Amplitude `Enterprise Account Executive`.
- [x] Dashboard Jobs view browser verification: `136 results`, Amplitude/Gusto rows, Greenhouse links.

### Hacker News Activity

Required result: nonzero scored HN rows with `relevanceScore` and `matchReasons`.

Suggested bounded backfill:

```bash
HN_PIPELINE_LIMIT=250 HN_LOOKBACK_DAYS=3650 HN_MAX_PAGES_PER_COMPANY=2 pnpm --filter @yc-intelligence/core pipeline:hn
```

Before launch, record:

- [x] Current HN post count: 1,674 HN posts.
- [ ] Score range and average relevance score.
- [x] REST `/hn-activity?limit=5&sort=signal` result: HTTP 200, `total: 1674`, first row `Launch HN: Sentrial (YC W26)`, `relevanceScore: 255`, match reasons present.
- [x] MCP `get_hn_activity` result: `total: 1674`, first row Sentrial Launch HN with score 255 and match reasons.
- [ ] Dashboard HN Activity view verification note.

### Founders

Required result: founder search returns real founder rows and company context.

Suggested bounded enrichment:

```bash
FOUNDER_PIPELINE_LIMIT=50 pnpm --filter @yc-intelligence/core pipeline:founders
```

Before launch, record:

- [x] Current founder count: 11,224 founders.
- [x] REST `/founders?limit=5` result: HTTP 200, `total: 11224`, first row Daniel Lewis with Convoy company context.
- [x] MCP `search_founders` result: `total: 11224`, first row Daniel Lewis with Convoy company context.
- [ ] Dashboard Founders view verification note.

### Semantic Search

Required result: semantic smoke succeeds and `/search/semantic` returns ranked companies.

Before launch, record:

- [x] `smoke:semantic` output with `ok: true`: query `AI infrastructure for developers`, `total: 2377`, `count: 5`.
- [x] REST `/search/semantic?query=developer%20tools%20for%20agents&limit=5` result: HTTP 200, `total: 2377`, first row `dari.dev`.
- [x] MCP `semantic_search` result: `total: 2377`, first row `dari.dev`.

## Manual Claude MCP Acceptance

Status: incomplete.

Prerequisites:

- Claude Code is authenticated, or `ANTHROPIC_API_KEY` is available.
- Local services are running, or `DATABASE_URL` points at a populated database.
- MCP server is built with `pnpm --filter @yc-intelligence/mcp build`.

Run the 10-query acceptance suite from `plans/implementation-plan.md` against the production MCP server. Record:

- [ ] Query text.
- [ ] Tool or tools used.
- [ ] Result quality.
- [ ] Any missing data or false-positive notes.

## CI And Release Hygiene

Current CI covers typecheck, package tests, build, and lint. It does not yet run DB-backed tests.

Before launch:

- [ ] Add Postgres/Redis services to CI.
- [ ] Run Prisma migrate deploy in CI.
- [ ] Run `RUN_DB_TESTS=1 pnpm --filter @yc-intelligence/core test` in CI.
- [ ] Confirm PR checks are green.
- [ ] Add license.
- [ ] Confirm README links and commands are current.
- [ ] Decide whether `.agents/` and `skills-lock.json` should be committed, ignored, or left local-only.

## Known Non-Launch Features

These are intentionally not required for the first launch:

- GitHub ingestion.
- Funding or Crunchbase enrichment.
- Perfect job board coverage across all YC companies.
- Perfect HN relevance for generic company names.
- Semantic search over jobs, founders, memory entries, README, or GitHub content.

## Final Launch Decision

Launch can proceed only when every Required Launch Gate is checked or explicitly waived with a dated rationale.
