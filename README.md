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
