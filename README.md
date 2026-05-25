# YC Company Intelligence

Fullstack-ready monorepo for a YC Company Intelligence MCP server, with shared core services that can also power a REST API and future web app.

## Packages

- `packages/core`: domain, repositories, services, pipeline, shared config, and utilities.
- `packages/mcp`: MCP server adapter over the core package.
- `packages/api`: Fastify REST API adapter over the core package.
- `packages/web`: Next.js frontend scaffold.

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm build
```

The `.env` file needs real `GITHUB_TOKEN` and `VOYAGE_API_KEY` values before pipeline and embedding work can run. `ANTHROPIC_API_KEY` is reserved for future Claude-powered enrichment.

Postgres is exposed on host port `5433` to avoid colliding with an existing local Postgres on `5432`.

## Pipeline

Individual pipeline slices are still available:

```bash
pnpm --filter @yc-intelligence/core pipeline:companies
pnpm --filter @yc-intelligence/core pipeline:jobs
pnpm --filter @yc-intelligence/core pipeline:hn
pnpm --filter @yc-intelligence/core pipeline:embeddings
```

The orchestrated paths run stages in dependency order: companies, jobs, HN, then embeddings.

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
- Existing per-stage limits still work, such as `JOB_PIPELINE_LIMIT`, `HN_PIPELINE_LIMIT`, and `EMBEDDING_PIPELINE_LIMIT`.
- `JOB_PIPELINE_OFFSET` runs job ingestion from a specific active-company offset for bounded batch windows.
