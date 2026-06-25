# YC Company Intelligence

YC Company Intelligence is a local intelligence workspace for exploring YC companies, founders, jobs, Hacker News activity, and semantic company matches. It ships three product surfaces over the same core services:

- MCP tools for Claude and other MCP clients.
- A Fastify REST API for programmatic access.
- A Next.js dashboard for browsing and demo workflows.

Shared domain logic, repositories, pipeline jobs, config, Prisma models, and utility code live in `packages/core`. The MCP, API, and web packages are delivery layers over that core.

## Packages

- `packages/core`: domain types, services, repositories, Prisma, ingestion pipeline, semantic search, config, and logging.
- `packages/mcp`: MCP server adapter over core services.
- `packages/api`: Fastify REST API adapter over core services.
- `packages/web`: Next.js dashboard for companies, jobs, founders, and HN activity.

## Setup

Prerequisites: Node.js 20+, pnpm 10.30.1, Docker, and Docker Compose.

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm --filter @yc-intelligence/core prisma:generate
pnpm --filter @yc-intelligence/core exec prisma migrate deploy
pnpm build
```

Local Postgres is exposed on host port `5433` to avoid colliding with a local Postgres on `5432`. Redis is exposed on `6379`.

Useful root commands:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

## Environment

`.env.example` includes the baseline local values. Important variables:

- `DATABASE_URL`: Postgres connection string. Defaults to the Docker Compose database at `localhost:5433`.
- `REDIS_URL`: Redis connection string for best-effort API caching.
- `VOYAGE_API_KEY`: required for embeddings, `pipeline:embeddings`, `semantic_search`, and semantic smoke.
- `GITHUB_TOKEN`: reserved for future GitHub ingestion. Current GitHub ingestion is deferred.
- `ANTHROPIC_API_KEY`: reserved for Claude-powered workflows and acceptance checks.
- `CRUNCHBASE_API_KEY`: reserved for future funding/enrichment work.
- `PIPELINE_CONCURRENCY`: concurrent pipeline fetch batch size.
- `PIPELINE_DELAY_MS`: base HTTP delay used by pipeline HTTP clients.
- `PIPELINE_STAGES`: comma-separated orchestrator stages, such as `jobs,hn`.
- `PIPELINE_RESUME_FROM`: resume an orchestrated run from a stage, such as `hn`.
- `PIPELINE_SCHEDULE_CRON`: cron expression for `pipeline:schedule`.
- `PIPELINE_RUN_ON_START`: set to `1` to run once when the scheduler starts.

Additional pipeline knobs supported by code:

- `FOUNDER_PIPELINE_LIMIT`, `FOUNDER_PIPELINE_OFFSET`
- `JOB_PIPELINE_LIMIT`, `JOB_PIPELINE_OFFSET`
- `HN_PIPELINE_LIMIT`, `HN_LOOKBACK_DAYS`, `HN_MAX_PAGES_PER_COMPANY`
- `EMBEDDING_PIPELINE_LIMIT`, `EMBEDDING_PIPELINE_OFFSET`, `EMBEDDING_PIPELINE_STATUS`, `EMBEDDING_PIPELINE_STALE_ONLY`, `EMBEDDING_PIPELINE_BATCH_SIZE`
- `SEMANTIC_SMOKE_LIMIT`, `SEMANTIC_SMOKE_QUERY`

## MCP Server

Build before launching the MCP server:

```bash
pnpm --filter @yc-intelligence/mcp build
```

The MCP binary is:

```bash
packages/mcp/dist/index.js
```

Production MCP tools:

- `search_companies`: search YC companies by query, batch, status, industry, location, hiring status, limit, and offset.
- `get_company_detail`: fetch a company by slug, including founders and recent HN posts when available.
- `search_jobs`: search open jobs by title, tech stack, remote status, batch, industry, company ID, limit, and offset.
- `search_founders`: search founders by name/query, company, batch, industry, previous employer, school, limit, and offset.
- `get_hn_activity`: search HN posts by company, batch, industry, post type, points, relevance score, date window, and sort.
- `semantic_search`: find companies by embedding similarity while preserving structured filters.
- `add_memory`: add project-level decisions, research notes, implementation notes, source summaries, or open questions.
- `search_memory`: search project memory entries.
- `supersede_memory`: replace an old project memory entry with a new active one.

Memory tools are for project memory only. They are intentionally separate from YC company intelligence data.

## REST API

Start the production API after building:

```bash
pnpm --filter @yc-intelligence/api build
PORT=3001 node packages/api/dist/index.js
```

Available GET routes:

- `/health`
- `/companies`
- `/companies/:slug`
- `/jobs`
- `/founders`
- `/hn-activity`
- `/search/semantic`

Examples:

```bash
curl 'http://127.0.0.1:3001/health'
curl 'http://127.0.0.1:3001/companies?batch=W24&isHiring=true&limit=10'
curl 'http://127.0.0.1:3001/companies/airbnb'
curl 'http://127.0.0.1:3001/jobs?title=Engineer&limit=10'
curl 'http://127.0.0.1:3001/founders?previousEmployer=Stripe&limit=10'
curl 'http://127.0.0.1:3001/hn-activity?postType=Show%20HN&minPoints=25&sort=signal'
curl 'http://127.0.0.1:3001/search/semantic?query=developer%20tools%20for%20agents&limit=10'
```

## Dashboard

The dashboard is a working Next.js app, not a scaffold. It provides:

- Company search and detail views.
- Open job search and filters.
- Founder search.
- HN Activity filters with relevance signals.
- Dataset metrics for demo readiness.

Run the API and dashboard in separate terminals:

```bash
pnpm build
PORT=3001 node packages/api/dist/index.js
pnpm --filter @yc-intelligence/web dev
```

The dashboard proxies `/api/*` to the REST API. By default it targets `http://127.0.0.1:3001`; set `YC_INTELLIGENCE_API_URL` for a different API base URL.

If port `3000` is occupied, run the app on another port:

```bash
pnpm --dir packages/web exec next dev -p 3002
```

## Pipeline

Build core before running pipeline commands:

```bash
pnpm --filter @yc-intelligence/core build
```

Individual pipeline stages:

```bash
pnpm --filter @yc-intelligence/core pipeline:companies
pnpm --filter @yc-intelligence/core pipeline:founders
pnpm --filter @yc-intelligence/core pipeline:jobs
pnpm --filter @yc-intelligence/core pipeline:hn
pnpm --filter @yc-intelligence/core pipeline:embeddings
```

Orchestrated pipeline paths:

```bash
pnpm --filter @yc-intelligence/core pipeline:seed
pnpm --filter @yc-intelligence/core pipeline:refresh
pnpm --filter @yc-intelligence/core pipeline:schedule
```

The orchestrator runs stages in dependency order:

```text
companies -> founders -> jobs -> hn -> embeddings
```

Useful bounded runs:

```bash
FOUNDER_PIPELINE_LIMIT=50 pnpm --filter @yc-intelligence/core pipeline:founders
JOB_PIPELINE_LIMIT=15 JOB_PIPELINE_OFFSET=1898 pnpm --filter @yc-intelligence/core pipeline:jobs
HN_PIPELINE_LIMIT=250 HN_LOOKBACK_DAYS=3650 HN_MAX_PAGES_PER_COMPANY=2 pnpm --filter @yc-intelligence/core pipeline:hn
EMBEDDING_PIPELINE_LIMIT=25 pnpm --filter @yc-intelligence/core pipeline:embeddings
PIPELINE_STAGES=jobs,hn JOB_PIPELINE_LIMIT=25 HN_PIPELINE_LIMIT=25 pnpm --filter @yc-intelligence/core pipeline:refresh
```

`pipeline:founders` enriches founder rows from YC company pages. `pipeline:hn` ingests Hacker News activity through Algolia, classifies posts as `Show HN`, `Ask HN`, `Launch`, `Hiring`, or `Other`, and stores relevance scores plus match reasons.

## Semantic Smoke

Semantic search depends on `VOYAGE_API_KEY`, local Postgres with pgvector, and company rows. Run:

```bash
pnpm --filter @yc-intelligence/core build
SEMANTIC_SMOKE_LIMIT=5 pnpm --filter @yc-intelligence/core smoke:semantic
```

Optional query override:

```bash
SEMANTIC_SMOKE_QUERY='AI infrastructure for developers' SEMANTIC_SMOKE_LIMIT=5 pnpm --filter @yc-intelligence/core smoke:semantic
```

Success returns JSON with `ok: true`, embedding refresh stats, and semantic search results.

## Known Data Limitations

- GitHub ingestion is deferred. Public repo matching is noisy for many YC companies, and GitHub should not be treated as canonical internal tech stack data.
- Funding and Crunchbase-style enrichment are deferred. Funding fields should not be assumed complete.
- Job board coverage is imperfect. The jobs pipeline currently supports common Greenhouse, Lever, and Ashby public board patterns, but many companies use custom career pages, different ATS slugs, or no supported board.
- HN relevance is probabilistic. Scores and match reasons improve precision, but generic company names can still need company-specific aliases or ignore rules.
- Semantic search is for discovery, not factual truth. Use structured filters and source rows for exact facts such as hiring status, batch, status, location, and tags.

## Current Demo Gate

Do not move to launch unless jobs are nonzero and representative across all three surfaces:

- REST `/jobs`
- MCP `search_jobs`
- Dashboard Jobs view

The latest recorded local restoration in `plans/context-memory.md` used:

```bash
JOB_PIPELINE_LIMIT=15 JOB_PIPELINE_OFFSET=1898 pnpm --filter @yc-intelligence/core pipeline:jobs
```

That run restored a real local corpus with 136 active jobs, including Greenhouse rows for Gusto and Amplitude.
