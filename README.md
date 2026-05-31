# YC Company Intelligence

Monorepo for YC company intelligence across MCP tools, a Fastify REST API, and a Next.js dashboard. Shared domain logic lives in `packages/core`; MCP, REST, and web packages are thin delivery layers over the same services.

## Packages

- `packages/core`: domain, repositories, services, pipeline, shared config, and utilities.
- `packages/mcp`: MCP server adapter over the core package.
- `packages/api`: Fastify REST API adapter over the core package.
- `packages/web`: Next.js dashboard for company, job, founder, and Hacker News activity exploration.

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm build
```

The `.env` file needs real `GITHUB_TOKEN` and `VOYAGE_API_KEY` values before pipeline and embedding work can run. `ANTHROPIC_API_KEY` is reserved for future Claude-powered enrichment.

Postgres is exposed on host port `5433` to avoid colliding with an existing local Postgres on `5432`.

## Dashboard

The dashboard is a real Next.js app, not a scaffold. It includes company search/detail, job search, founder search, HN activity filters, and summary metrics backed by the REST API.

Run the API and web app in separate terminals after building:

```bash
pnpm build
PORT=3001 node packages/api/dist/index.js
pnpm --filter @yc-intelligence/web dev
```

The web app proxies `/api/*` to the REST API. By default it targets `http://127.0.0.1:3001`; override that with `YC_INTELLIGENCE_API_URL` if the API runs elsewhere.

## REST API

The production API server wires Prisma-backed services for companies, jobs, founders, HN activity, and semantic search. Available GET routes:

- `/health`
- `/companies`
- `/companies/:slug`, including founders and recent HN posts when present
- `/jobs`
- `/founders`
- `/hn-activity`
- `/search/semantic`

Useful examples:

```bash
curl 'http://127.0.0.1:3001/companies?batch=W24&isHiring=true&limit=10'
curl 'http://127.0.0.1:3001/founders?previousEmployer=Stripe&limit=10'
curl 'http://127.0.0.1:3001/hn-activity?postType=Show%20HN&minPoints=25&sort=signal'
curl 'http://127.0.0.1:3001/search/semantic?query=developer%20tools%20for%20agents&limit=10'
```

## MCP Tools

The MCP server registers these production tools:

- `search_companies`
- `get_company_detail`
- `search_jobs`
- `search_founders`
- `get_hn_activity`
- `semantic_search`
- `add_memory`
- `search_memory`
- `supersede_memory`

The memory tools store project-level decisions, research notes, implementation notes, source summaries, and open questions separately from YC company intelligence data.

## Pipeline

Individual pipeline slices are still available:

```bash
pnpm --filter @yc-intelligence/core pipeline:companies
pnpm --filter @yc-intelligence/core pipeline:founders
pnpm --filter @yc-intelligence/core pipeline:jobs
pnpm --filter @yc-intelligence/core pipeline:hn
pnpm --filter @yc-intelligence/core pipeline:embeddings
```

The `pipeline:founders` slice enriches founder rows from YC company pages. The HN slice ingests Hacker News activity through the Algolia API, classifies posts as `Show HN`, `Ask HN`, `Launch`, `Hiring`, or `Other`, and stores relevance scores plus match reasons.

The orchestrated paths run stages in dependency order: companies, founders, jobs, HN, then embeddings.

```bash
pnpm --filter @yc-intelligence/core pipeline:seed
pnpm --filter @yc-intelligence/core pipeline:refresh
pnpm --filter @yc-intelligence/core pipeline:schedule
```

Useful runtime knobs:

- `PIPELINE_STAGES=jobs,hn` runs only selected stages.
- `PIPELINE_RESUME_FROM=hn` resumes from a later stage in the selected stage list.
- `PIPELINE_SCHEDULE_CRON="0 3 * * *"` controls the scheduler cron.
- `PIPELINE_RUN_ON_START=1` runs immediately when the scheduler starts.
- Existing per-stage limits still work, such as `FOUNDER_PIPELINE_LIMIT`, `JOB_PIPELINE_LIMIT`, `HN_PIPELINE_LIMIT`, and `EMBEDDING_PIPELINE_LIMIT`.
- `FOUNDER_PIPELINE_OFFSET` runs founder enrichment from a specific active-company offset for bounded batch windows.
- `JOB_PIPELINE_OFFSET` runs job ingestion from a specific active-company offset for bounded batch windows.
- `HN_LOOKBACK_DAYS` and `HN_MAX_PAGES_PER_COMPANY` control HN backfill scope.
