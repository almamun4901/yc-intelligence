# YC Company Intelligence — Technical Implementation Plan

> **Role:** Senior Software Engineer  
> **Architecture:** Fullstack-ready Monorepo (MCP today → REST API → Web App tomorrow)  
> **Version:** 1.0  

---

## Table of Contents

1. [Architecture Philosophy](#1-architecture-philosophy)
2. [Repository Structure](#2-repository-structure)
3. [Technology Decisions](#3-technology-decisions)
4. [Phase 0 — Repository & Environment](#phase-0--repository--environment)
5. [Phase 1 — Database & Domain Layer](#phase-1--database--domain-layer)
6. [Phase 2 — Data Pipeline](#phase-2--data-pipeline)
7. [Phase 3 — Service Layer](#phase-3--service-layer)
8. [Phase 4 — MCP Package](#phase-4--mcp-package)
9. [Phase 5 — REST API Package](#phase-5--rest-api-package)
10. [Phase 6 — Testing Strategy](#phase-6--testing-strategy)
11. [Phase 7 — CI/CD & DevEx](#phase-7--cicd--devex)
12. [Dependency Map](#12-dependency-map)

---

## 1. Architecture Philosophy

### The Core Problem With MCP-Only Design

If you build the MCP directly against the database, you paint yourself into a corner:

```
❌ Naive approach (MCP-only):
   Claude → MCP Tool → Prisma → Database
   
   Problem: Your logic is trapped inside MCP handlers.
   To build a web app, you copy-paste everything.
```

### The Right Approach: Hexagonal Architecture

Business logic lives in one place (`packages/core`). MCP and REST API are just **delivery adapters** that call the same services.

```
✅ Fullstack-ready approach:

   Claude  → MCP Tool ─────────┐
                                ├──→ Service Layer → Repository → Database
   Browser → REST API ─────────┘
   
   The service layer is the product.
   MCP and REST API are just interfaces into it.
```

### The Three Laws of This Codebase

1. **No business logic in MCP handlers or API route handlers.** They call services. Period.
2. **No database queries outside of repositories.** Services call repositories, not Prisma directly.
3. **Every package has a single responsibility.** `core` owns data, `mcp` owns Claude tools, `api` owns HTTP.

---

## 2. Repository Structure

```
yc-intelligence/
├── packages/
│   ├── core/                      # All business logic — shared by everything
│   │   ├── src/
│   │   │   ├── domain/            # Pure TypeScript types — no dependencies
│   │   │   │   ├── company.ts
│   │   │   │   ├── job.ts
│   │   │   │   ├── founder.ts
│   │   │   │   ├── funding.ts
│   │   │   │   └── hnPost.ts
│   │   │   ├── repositories/      # Interfaces (contracts) for data access
│   │   │   │   ├── ICompanyRepository.ts
│   │   │   │   ├── IJobRepository.ts
│   │   │   │   └── ...
│   │   │   ├── repositories/impl/ # Prisma implementations of the interfaces
│   │   │   │   ├── PrismaCompanyRepository.ts
│   │   │   │   └── ...
│   │   │   ├── services/          # Business logic — call repositories, not DB
│   │   │   │   ├── CompanyService.ts
│   │   │   │   ├── JobService.ts
│   │   │   │   ├── FounderService.ts
│   │   │   │   ├── EmbeddingService.ts
│   │   │   │   └── HNService.ts
│   │   │   ├── pipeline/          # Data fetching & ETL
│   │   │   │   ├── fetchers/
│   │   │   │   │   ├── YCFetcher.ts
│   │   │   │   │   ├── JobBoardFetcher.ts
│   │   │   │   │   ├── HNFetcher.ts
│   │   │   │   │   ├── GitHubFetcher.ts
│   │   │   │   │   └── EdgarFetcher.ts
│   │   │   │   ├── transformers/  # Raw API data → domain models
│   │   │   │   │   ├── YCTransformer.ts
│   │   │   │   │   └── JobTransformer.ts
│   │   │   │   ├── PipelineOrchestrator.ts
│   │   │   │   └── Scheduler.ts
│   │   │   ├── lib/               # Shared utilities
│   │   │   │   ├── httpClient.ts  # Axios with retry + rate limiting
│   │   │   │   ├── techExtractor.ts
│   │   │   │   ├── fuzzyMatch.ts
│   │   │   │   └── logger.ts
│   │   │   └── index.ts           # Public API of core package
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   │
│   ├── mcp/                       # MCP server — thin adapter over core services
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   │   ├── searchCompanies.ts
│   │   │   │   ├── getCompanyDetail.ts
│   │   │   │   ├── searchJobs.ts
│   │   │   │   ├── searchFounders.ts
│   │   │   │   ├── getHNActivity.ts
│   │   │   │   └── semanticSearch.ts
│   │   │   ├── formatters/        # Format service output for Claude
│   │   │   │   └── companyFormatter.ts
│   │   │   └── index.ts           # MCP server entry point
│   │   └── package.json
│   │
│   ├── api/                       # REST API — thin adapter over core services
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── companies.ts
│   │   │   │   ├── jobs.ts
│   │   │   │   └── founders.ts
│   │   │   ├── middleware/
│   │   │   │   ├── cache.ts       # Redis caching middleware
│   │   │   │   ├── rateLimiter.ts
│   │   │   │   └── errorHandler.ts
│   │   │   └── index.ts           # Fastify server entry point
│   │   └── package.json
│   │
│   └── web/                       # Next.js frontend (scaffold only for now)
│       ├── src/
│       │   ├── app/
│       │   └── components/
│       └── package.json
│
├── docker-compose.yml             # Postgres + pgvector + Redis
├── turbo.json                     # Turborepo pipeline config
├── package.json                   # Root workspace config
├── tsconfig.base.json             # Shared TS config
└── .env.example
```

---

## 3. Technology Decisions

| Concern | Choice | Why |
|---------|--------|-----|
| Monorepo | Turborepo | Task caching, parallel builds, dep graph awareness |
| Runtime | Node.js 20 LTS | Stable, MCP SDK is Node-native |
| Language | TypeScript 5 (strict) | Type safety across all packages |
| Database | PostgreSQL 16 + pgvector | Relational + vector search in one place |
| ORM | Prisma 5 | Best TS integration, migration tooling |
| Caching | Redis 7 | API response caching, rate limit counters |
| HTTP | Axios | Interceptors for retry/rate-limit logic |
| MCP SDK | `@modelcontextprotocol/sdk` | Official, required |
| API Server | Fastify | 2x faster than Express, built-in schema validation |
| API Validation | Zod | Runtime type safety, shared with core |
| Embeddings | Voyage `voyage-3.5` | Anthropic-recommended embedding provider, 1024 dims |
| Scheduler | node-cron | Lightweight, enough for our needs |
| Testing | Vitest | TS-native, fast, compatible with Node |
| Test DB | Docker PostgreSQL | Isolated, reproducible, no shared state |
| Logging | Pino | Structured JSON logs, Fastify's default |
| Package Manager | pnpm | Fast, disk-efficient, great workspace support |

---

## Phase 0 — Repository & Environment

### Task 0.1 — Initialize Monorepo with Turborepo

**Goal:** A working monorepo where `pnpm install` at the root installs all packages, and Turborepo can build/test all packages in dependency order.

**Steps:**

```bash
# 1. Create root directory and initialize
mkdir yc-intelligence && cd yc-intelligence
pnpm init

# 2. Install Turborepo
pnpm add -D turbo -w

# 3. Create workspace config in root package.json
# Add this to package.json:
{
  "name": "yc-intelligence",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "workspaces": ["packages/*"]
}

# 4. Create turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}

# 5. Create shared tsconfig
# tsconfig.base.json at root:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}

# 6. Scaffold all packages
mkdir -p packages/core/src packages/mcp/src packages/api/src packages/web/src

# 7. Initialize each package
cd packages/core && pnpm init
cd packages/mcp && pnpm init
cd packages/api && pnpm init
```

**How to verify this task is complete:**

```bash
# From root, run:
pnpm install

# Expected: No errors. node_modules created at root and in each package.
# Check symlinks:
ls packages/mcp/node_modules | grep core
# Expected: @yc-intelligence/core is symlinked (after you add it as a dep in mcp/package.json)

pnpm turbo build
# Expected: Build pipeline runs in order: core → mcp, core → api (parallel)
```

---

### Task 0.2 — Docker Compose: PostgreSQL + pgvector + Redis

**Goal:** `docker compose up -d` starts a local Postgres (with pgvector extension) and Redis. No manual DB installation needed on any machine.

**Steps:**

```yaml
# docker-compose.yml at root
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg16      # Official image with pgvector pre-installed
    container_name: yc_postgres
    environment:
      POSTGRES_USER: yc_user
      POSTGRES_PASSWORD: yc_password
      POSTGRES_DB: yc_intelligence
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U yc_user -d yc_intelligence"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: yc_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

**How to verify this task is complete:**

```bash
# Start containers
docker compose up -d

# Check health
docker compose ps
# Expected: Both services show "healthy" status

# Verify Postgres is up and pgvector is installed
docker exec yc_postgres psql -U yc_user -d yc_intelligence -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extname FROM pg_extension WHERE extname = 'vector';"
# Expected: Returns row with "vector"

# Verify Redis
docker exec yc_redis redis-cli ping
# Expected: PONG

# Verify connection string works
psql "postgresql://yc_user:yc_password@localhost:5432/yc_intelligence" -c "\conninfo"
# Expected: Connected to database "yc_intelligence"
```

---

### Task 0.3 — Environment Configuration with Zod Validation

**Goal:** A single `config.ts` in `core` that validates all environment variables at startup. If a required variable is missing, the app crashes immediately with a clear error — not 3 layers deep when it's first used.

**Steps:**

```bash
# In packages/core
pnpm add zod dotenv
```

```typescript
// packages/core/src/lib/config.ts
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const ConfigSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // External APIs
  GITHUB_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().min(1),
  CRUNCHBASE_API_KEY: z.string().optional(),

  // Pipeline
  PIPELINE_CONCURRENCY: z.coerce.number().default(5),
  PIPELINE_DELAY_MS: z.coerce.number().default(500),

  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

// This throws at startup if any required env var is missing.
// parseResult.error will tell you EXACTLY which variable is wrong.
const parseResult = ConfigSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parseResult.error.format())
  process.exit(1)
}

export const config = parseResult.data
export type Config = typeof config
```

```bash
# .env.example at root
DATABASE_URL="postgresql://yc_user:yc_password@localhost:5432/yc_intelligence"
REDIS_URL="redis://localhost:6379"
GITHUB_TOKEN="ghp_your_token_here"
ANTHROPIC_API_KEY="sk-ant-your_key_here"
VOYAGE_API_KEY="pa-your_key_here"
CRUNCHBASE_API_KEY=""
PIPELINE_CONCURRENCY=5
PIPELINE_DELAY_MS=500
NODE_ENV=development
```

**How to verify this task is complete:**

```bash
# Test 1: Valid config loads correctly
cp .env.example .env
# Fill in real values for GITHUB_TOKEN and VOYAGE_API_KEY
node -e "require('./packages/core/dist/lib/config').config" 
# Expected: No error, config object printed

# Test 2: Missing required variable crashes with clear message
GITHUB_TOKEN="" node -e "require('./packages/core/dist/lib/config')"
# Expected: Process exits with code 1 and prints:
# ❌ Invalid environment variables:
# { GITHUB_TOKEN: { _errors: ['String must contain at least 1 character(s)'] } }

# Test 3: Wrong type crashes clearly
PIPELINE_CONCURRENCY="not_a_number" node -e "..."
# Expected: Zod coerces this correctly (coerce.number() handles it) OR 
# crashes with clear message about PIPELINE_CONCURRENCY
```

---

### Task 0.4 — Structured Logger

**Goal:** All logs are structured JSON with timestamps, package name, and log level. Easy to grep in production. No `console.log` anywhere in the codebase.

**Steps:**

```bash
# In packages/core
pnpm add pino pino-pretty
```

```typescript
// packages/core/src/lib/logger.ts
import pino from 'pino'
import { config } from './config'

export const createLogger = (name: string) =>
  pino({
    name,
    level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  })

// Usage: const logger = createLogger('YCFetcher')
// logger.info({ companiesFound: 42 }, 'Fetch complete')
// logger.error({ err }, 'Fetch failed')
```

**How to verify this task is complete:**

```bash
# Run this quick script
node -e "
  const { createLogger } = require('./packages/core/dist/lib/logger')
  const log = createLogger('test')
  log.info({ userId: 123 }, 'User logged in')
  log.error({ err: new Error('test') }, 'Something failed')
"
# Expected in development: Colorized, human-readable output with timestamps
# Expected in production: Raw JSON lines — easy to pipe to log aggregators
```

---

## Phase 1 — Database & Domain Layer

### Task 1.1 — Domain Types (Pure TypeScript, Zero Dependencies)

**Goal:** The `domain/` folder contains pure TypeScript interfaces that define the shape of every entity. No Prisma, no Zod, no database. These types are the language of the entire codebase.

**Steps:**

```bash
# packages/core/src/domain/company.ts
export interface Company {
  id: string
  name: string
  slug: string
  batch: string | null          // "W24", "S23"
  status: CompanyStatus
  description: string | null
  shortDescription: string | null
  website: string | null
  teamSize: TeamSize | null
  isHiring: boolean
  tags: string[]
  location: string | null
  createdAt: Date
  updatedAt: Date
}

export type CompanyStatus = 'Active' | 'Acquired' | 'Inactive' | 'Dead'
export type TeamSize = '1-10' | '11-50' | '51-200' | '201-500' | '500+'

export interface CompanyWithRelations extends Company {
  founders: Founder[]
  jobs: Job[]
  hnPosts: HNPost[]
  funding: Funding[]
  githubOrg: GitHubOrg | null
}

# packages/core/src/domain/job.ts
export interface Job {
  id: string
  companyId: string
  title: string
  department: string | null
  location: string | null
  isRemote: boolean
  description: string | null
  techStack: string[]
  atsSource: ATSSource
  applyUrl: string
  isActive: boolean
  postedAt: Date | null
  fetchedAt: Date
}

export type ATSSource = 'greenhouse' | 'lever' | 'ashby' | 'custom'

# packages/core/src/domain/founder.ts
export interface Founder {
  id: string
  companyId: string
  name: string
  linkedinUrl: string | null
  previousEmployers: string[]   # Extracted from LinkedIn title if available
  schools: string[]
}

# packages/core/src/domain/hnPost.ts
export interface HNPost {
  id: string
  companyId: string
  hnId: string
  title: string
  url: string | null
  hnUrl: string
  points: number
  commentCount: number
  postType: HNPostType
  sentimentScore: number        # Derived: (points + comments*2) / age_days
  postedAt: Date
}

export type HNPostType = 'Show HN' | 'Ask HN' | 'Hiring' | 'Other'

# packages/core/src/domain/funding.ts
export interface Funding {
  id: string
  companyId: string
  amountUsdCents: bigint | null
  round: FundingRound | null
  date: Date | null
  investors: string[]
  source: FundingSource
}

export type FundingRound = 'Pre-Seed' | 'Seed' | 'Series A' | 'Series B' | 'Series C' | 'Series D+'
export type FundingSource = 'edgar' | 'crunchbase' | 'manual'

# packages/core/src/domain/github.ts
export interface GitHubOrg {
  id: string
  companyId: string
  orgName: string
  totalStars: number
  languages: string[]
  lastCommitDate: Date | null
  contributorCount: number
  isActive: boolean             # lastCommitDate within 90 days
}

# packages/core/src/domain/index.ts — re-export everything
export * from './company'
export * from './job'
export * from './founder'
export * from './hnPost'
export * from './funding'
export * from './github'
```

**How to verify this task is complete:**

```bash
# Compile the domain types
cd packages/core && pnpm tsc --noEmit

# Expected: Zero TypeScript errors
# These are pure types, there is nothing to "run"

# Write a quick type-check script:
# packages/core/src/domain/__tests__/types.test.ts
import type { Company, Job, Founder } from '../index'

// TypeScript will error at compile time if types are wrong
const company: Company = {
  id: 'test',
  name: 'Stripe',
  slug: 'stripe',
  batch: 'S09',
  status: 'Acquired',        # This should typecheck
  // status: 'Unknown',      # This should ERROR — not in CompanyStatus union
  ...
}

pnpm vitest run src/domain/__tests__/types.test.ts
# Expected: 0 errors (TypeScript compilation is the test)
```

---

### Task 1.2 — Prisma Schema & Migrations

**Goal:** Full database schema as Prisma models. Running `prisma migrate dev` creates all tables with correct types, indexes, and constraints.

**Steps:**

```bash
# Install Prisma in core
cd packages/core
pnpm add @prisma/client
pnpm add -D prisma
npx prisma init --datasource-provider postgresql
```

```prisma
// packages/core/prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

model Company {
  id               String    @id @default(uuid())
  name             String
  slug             String    @unique
  batch            String?
  status           String    @default("Active")
  description      String?
  shortDescription String?
  website          String?
  teamSize         String?
  isHiring         Boolean   @default(false)
  tags             String[]
  location         String?
  rawData          Json?     // Store original API response for debugging
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  founders  Founder[]
  jobs      Job[]
  hnPosts   HNPost[]
  funding   Funding[]
  githubOrg GitHubOrg?
  embed     CompanyEmbed?

  @@index([batch])
  @@index([status])
  @@index([isHiring])
  @@index([tags], type: Gin)  // GIN index for array contains queries
}

model Founder {
  id                String   @id @default(uuid())
  companyId         String
  name              String
  linkedinUrl       String?
  previousEmployers String[]
  schools           String[]
  createdAt         DateTime @default(now())

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([previousEmployers], type: Gin)
}

model Job {
  id          String    @id @default(uuid())
  companyId   String
  title       String
  department  String?
  location    String?
  isRemote    Boolean   @default(false)
  description String?
  techStack   String[]
  atsSource   String    // greenhouse | lever | ashby | custom
  applyUrl    String
  isActive    Boolean   @default(true)
  postedAt    DateTime?
  fetchedAt   DateTime  @default(now())

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([isActive])
  @@index([techStack], type: Gin)
  @@index([postedAt])
}

model HNPost {
  id             String   @id @default(uuid())
  companyId      String
  hnId           String   @unique
  title          String
  url            String?
  hnUrl          String
  points         Int      @default(0)
  commentCount   Int      @default(0)
  postType       String   // Show HN | Ask HN | Hiring | Other
  sentimentScore Float    @default(0)
  postedAt       DateTime
  fetchedAt      DateTime @default(now())

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([postedAt])
  @@index([sentimentScore])
}

model Funding {
  id              String    @id @default(uuid())
  companyId       String
  amountUsdCents  BigInt?
  round           String?
  date            DateTime?
  investors       String[]
  source          String    // edgar | crunchbase | manual
  createdAt       DateTime  @default(now())

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([date])
}

model GitHubOrg {
  id               String    @id @default(uuid())
  companyId        String    @unique
  orgName          String
  totalStars       Int       @default(0)
  languages        String[]
  lastCommitDate   DateTime?
  contributorCount Int       @default(0)
  fetchedAt        DateTime  @default(now())

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
}

model CompanyEmbed {
  id         String                      @id @default(uuid())
  companyId  String                      @unique
  embedding  Unsupported("vector(1024)")
  createdAt  DateTime                    @default(now())
  updatedAt  DateTime                    @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
}

model RefreshLog {
  id          String   @id @default(uuid())
  source      String   // yc | jobs | hn | github | edgar
  startedAt   DateTime
  completedAt DateTime?
  recordCount Int      @default(0)
  errorCount  Int      @default(0)
  status      String   // running | success | failed
  errorMsg    String?
}
```

```bash
# Run migration
npx prisma migrate dev --name init
npx prisma generate
```

**How to verify this task is complete:**

```bash
# 1. Migration ran cleanly
npx prisma migrate status
# Expected: "All migrations have been applied"

# 2. All tables exist with correct columns
docker exec yc_postgres psql -U yc_user -d yc_intelligence -c "\dt"
# Expected: Lists all 8 tables: companies, founders, jobs, hn_posts, funding, 
#           github_orgs, company_embeds, refresh_logs

# 3. pgvector column exists correctly
docker exec yc_postgres psql -U yc_user -d yc_intelligence \
  -c "\d company_embeds"
# Expected: embedding column shows type "vector(1024)"

# 4. GIN indexes exist for array columns
docker exec yc_postgres psql -U yc_user -d yc_intelligence \
  -c "SELECT indexname FROM pg_indexes WHERE tablename = 'companies';"
# Expected: Includes "companies_tags_idx" (GIN index)

# 5. Prisma client generates without errors
npx prisma generate
# Expected: "Generated Prisma Client" with no warnings
```

---

### Task 1.3 — Repository Interfaces

**Goal:** Define the data access contract as TypeScript interfaces. Services depend on these interfaces, not on Prisma. This is what makes the codebase testable — you can swap Prisma for an in-memory implementation in tests.

**Steps:**

```typescript
// packages/core/src/repositories/ICompanyRepository.ts

import type { Company, CompanyWithRelations, CompanyStatus } from '../domain'

export interface CompanySearchParams {
  query?: string            // Full-text search on name + description
  batch?: string
  status?: CompanyStatus
  industry?: string
  isHiring?: boolean
  limit?: number
  offset?: number
}

export interface ICompanyRepository {
  findById(id: string): Promise<Company | null>
  findBySlug(slug: string): Promise<Company | null>
  findBySlugWithRelations(slug: string): Promise<CompanyWithRelations | null>
  search(params: CompanySearchParams): Promise<{ data: Company[]; total: number }>
  upsert(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company>
  upsertMany(companies: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<number>
  findBySemanticSimilarity(embedding: number[], limit: number): Promise<Array<Company & { similarity: number }>>
}

// packages/core/src/repositories/IJobRepository.ts
export interface JobSearchParams {
  techStack?: string[]      // Match ANY of these
  title?: string
  companyId?: string
  isRemote?: boolean
  batch?: string
  industry?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

export interface IJobRepository {
  findById(id: string): Promise<Job | null>
  findByCompanyId(companyId: string): Promise<Job[]>
  search(params: JobSearchParams): Promise<{ data: Job[]; total: number }>
  upsertMany(jobs: Omit<Job, 'id' | 'fetchedAt'>[]): Promise<number>
  markInactiveForCompany(companyId: string, activeJobUrls: string[]): Promise<number>
}

// packages/core/src/repositories/IFounderRepository.ts
export interface FounderSearchParams {
  previousEmployer?: string
  school?: string
  name?: string
  limit?: number
}

export interface IFounderRepository {
  findByCompanyId(companyId: string): Promise<Founder[]>
  search(params: FounderSearchParams): Promise<Founder[]>
  upsertMany(founders: Omit<Founder, 'id' | 'createdAt'>[]): Promise<number>
}
```

**How to verify this task is complete:**

```bash
# Compile — interfaces have no runtime footprint, so compilation IS the test
cd packages/core && pnpm tsc --noEmit

# Expected: Zero errors

# Manual check: Confirm interfaces are exported from the package index
grep -n "ICompanyRepository\|IJobRepository\|IFounderRepository" src/index.ts
# Expected: All three interfaces are exported
```

---

### Task 1.4 — Prisma Repository Implementations

**Goal:** Concrete implementations of repository interfaces using Prisma. Services will receive these via constructor injection.

**Steps:**

```typescript
// packages/core/src/repositories/impl/PrismaCompanyRepository.ts

import { PrismaClient } from '@prisma/client'
import type { ICompanyRepository, CompanySearchParams } from '../ICompanyRepository'
import type { Company, CompanyWithRelations } from '../../domain'

export class PrismaCompanyRepository implements ICompanyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySlug(slug: string): Promise<Company | null> {
    const row = await this.prisma.company.findUnique({ where: { slug } })
    return row ? this.toDomain(row) : null
  }

  async search(params: CompanySearchParams): Promise<{ data: Company[]; total: number }> {
    const where = this.buildWhereClause(params)
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        take: params.limit ?? 20,
        skip: params.offset ?? 0,
        orderBy: { batch: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ])
    return { data: rows.map(this.toDomain), total }
  }

  async findBySemanticSimilarity(
    embedding: number[],
    limit: number,
  ): Promise<Array<Company & { similarity: number }>> {
    // pgvector cosine similarity query via raw SQL
    const vector = `[${embedding.join(',')}]`
    const rows = await this.prisma.$queryRaw<Array<{ id: string; similarity: number }>>`
      SELECT c.*, 1 - (e.embedding <=> ${vector}::vector) AS similarity
      FROM companies c
      JOIN company_embeds e ON e.company_id = c.id
      WHERE c.status = 'Active'
      ORDER BY e.embedding <=> ${vector}::vector
      LIMIT ${limit}
    `
    return rows.map(row => ({ ...this.toDomain(row), similarity: row.similarity }))
  }

  async upsert(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
    const row = await this.prisma.company.upsert({
      where: { slug: data.slug },
      update: { ...data, updatedAt: new Date() },
      create: data,
    })
    return this.toDomain(row)
  }

  private buildWhereClause(params: CompanySearchParams) {
    return {
      ...(params.query && {
        OR: [
          { name: { contains: params.query, mode: 'insensitive' } },
          { description: { contains: params.query, mode: 'insensitive' } },
        ],
      }),
      ...(params.batch && { batch: params.batch }),
      ...(params.status && { status: params.status }),
      ...(params.isHiring !== undefined && { isHiring: params.isHiring }),
      ...(params.industry && { tags: { has: params.industry } }),
    }
  }

  // Map Prisma row → Domain type (never leak Prisma types out of this class)
  private toDomain(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      batch: row.batch,
      status: row.status as any,
      description: row.description,
      shortDescription: row.shortDescription,
      website: row.website,
      teamSize: row.teamSize as any,
      isHiring: row.isHiring,
      tags: row.tags,
      location: row.location,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
```

**How to verify this task is complete:**

```bash
# Integration test against real (Docker) database
# packages/core/src/repositories/impl/__tests__/PrismaCompanyRepository.test.ts

import { PrismaClient } from '@prisma/client'
import { PrismaCompanyRepository } from '../PrismaCompanyRepository'

describe('PrismaCompanyRepository', () => {
  let prisma: PrismaClient
  let repo: PrismaCompanyRepository

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
    repo = new PrismaCompanyRepository(prisma)
  })

  afterAll(() => prisma.$disconnect())

  beforeEach(async () => {
    await prisma.company.deleteMany()  // Clean state for each test
  })

  it('upserts and retrieves a company by slug', async () => {
    await repo.upsert({ name: 'Stripe', slug: 'stripe', status: 'Acquired', ... })
    const found = await repo.findBySlug('stripe')
    expect(found?.name).toBe('Stripe')
  })

  it('returns null for unknown slug', async () => {
    const found = await repo.findBySlug('nonexistent-company')
    expect(found).toBeNull()
  })

  it('searches by batch', async () => {
    await repo.upsert({ slug: 'company-a', batch: 'W24', ... })
    await repo.upsert({ slug: 'company-b', batch: 'S23', ... })
    const { data, total } = await repo.search({ batch: 'W24' })
    expect(total).toBe(1)
    expect(data[0].batch).toBe('W24')
  })
})

# Run tests
DATABASE_URL="postgresql://yc_user:yc_password@localhost:5432/yc_intelligence" \
  pnpm vitest run src/repositories/impl/__tests__/

# Expected: All 3 tests pass in < 2 seconds
```

---

## Phase 2 — Data Pipeline

### Task 2.1 — HTTP Client with Retry & Rate Limiting

**Goal:** A shared Axios wrapper that automatically retries on 429/5xx, respects rate limits with delays, and logs every request. All fetchers use this client — never raw Axios.

**Steps:**

```typescript
// packages/core/src/lib/httpClient.ts

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { createLogger } from './logger'
import { config } from './config'

const logger = createLogger('HttpClient')

interface RetryConfig {
  maxRetries?: number
  delayMs?: number
  backoffFactor?: number
}

export function createHttpClient(
  baseURL?: string,
  retryConfig: RetryConfig = {}
): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 15_000 })
  const { maxRetries = 3, delayMs = config.PIPELINE_DELAY_MS, backoffFactor = 2 } = retryConfig

  // Add base delay between all requests (rate limiting)
  client.interceptors.request.use(async (req) => {
    await sleep(delayMs)
    logger.info({ url: req.url, method: req.method }, 'HTTP request')
    return req
  })

  // Retry on 429 and 5xx
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const { config: reqConfig, response } = error
      reqConfig._retryCount = reqConfig._retryCount ?? 0

      const shouldRetry =
        reqConfig._retryCount < maxRetries &&
        (response?.status === 429 || (response?.status >= 500 && response?.status < 600))

      if (!shouldRetry) throw error

      reqConfig._retryCount++
      const waitMs = delayMs * Math.pow(backoffFactor, reqConfig._retryCount)

      logger.warn(
        { url: reqConfig.url, status: response?.status, attempt: reqConfig._retryCount },
        `Retrying in ${waitMs}ms`
      )

      await sleep(waitMs)
      return client(reqConfig)
    }
  )

  return client
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
```

**How to verify this task is complete:**

```bash
# Unit test with a mock server
# packages/core/src/lib/__tests__/httpClient.test.ts

import { createHttpClient } from '../httpClient'
import nock from 'nock'   # pnpm add -D nock

describe('httpClient', () => {
  it('retries on 429 and eventually succeeds', async () => {
    nock('https://example.com')
      .get('/test').reply(429)
      .get('/test').reply(429)
      .get('/test').reply(200, { ok: true })

    const client = createHttpClient('https://example.com', { delayMs: 10 })
    const res = await client.get('/test')
    expect(res.data).toEqual({ ok: true })
  })

  it('throws after maxRetries exceeded', async () => {
    nock('https://example.com')
      .get('/test').times(4).reply(500)

    const client = createHttpClient('https://example.com', { maxRetries: 3, delayMs: 10 })
    await expect(client.get('/test')).rejects.toThrow()
  })
})

pnpm vitest run src/lib/__tests__/httpClient.test.ts
# Expected: Both tests pass
```

---

### Task 2.2 — YC Fetcher + Transformer

**Goal:** Fetch all YC companies from the public API, transform raw JSON to domain types, and upsert into the database. Handles pagination automatically.

**Steps:**

```typescript
// packages/core/src/pipeline/fetchers/YCFetcher.ts

import { createHttpClient } from '../../lib/httpClient'
import { createLogger } from '../../lib/logger'
import type { ICompanyRepository } from '../../repositories/ICompanyRepository'
import type { IFounderRepository } from '../../repositories/IFounderRepository'
import { YCTransformer } from '../transformers/YCTransformer'

const logger = createLogger('YCFetcher')
const YC_API = 'https://api.ycombinator.com/v0.1'

export class YCFetcher {
  private client = createHttpClient(YC_API)
  private transformer = new YCTransformer()

  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly founderRepo: IFounderRepository,
  ) {}

  async run(): Promise<{ companies: number; founders: number }> {
    logger.info('Starting YC company fetch')
    const allCompanies = await this.fetchAllPages()
    
    const domainCompanies = allCompanies.map(raw => this.transformer.toCompany(raw))
    const companiesInserted = await this.companyRepo.upsertMany(domainCompanies)

    const allFounders = allCompanies.flatMap(raw => this.transformer.toFounders(raw))
    const foundersInserted = await this.founderRepo.upsertMany(allFounders)

    logger.info({ companies: companiesInserted, founders: foundersInserted }, 'YC fetch complete')
    return { companies: companiesInserted, founders: foundersInserted }
  }

  private async fetchAllPages(): Promise<any[]> {
    const results: any[] = []
    let page = 1

    while (true) {
      const res = await this.client.get('/companies', { params: { page, limit: 100 } })
      const data = res.data?.companies ?? []
      if (data.length === 0) break
      results.push(...data)
      logger.info({ page, fetched: data.length, total: results.length }, 'Page fetched')
      page++
    }

    return results
  }
}

// packages/core/src/pipeline/transformers/YCTransformer.ts
export class YCTransformer {
  toCompany(raw: any): Omit<Company, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      name: raw.name,
      slug: raw.slug,
      batch: raw.batch ?? null,
      status: this.normalizeStatus(raw.status),
      description: raw.long_description ?? null,
      shortDescription: raw.one_liner ?? null,
      website: raw.website ?? null,
      teamSize: this.normalizeTeamSize(raw.team_size),
      isHiring: raw.is_hiring ?? false,
      tags: raw.tags ?? [],
      location: raw.location ?? null,
      rawData: raw,
    }
  }

  toFounders(raw: any): Omit<Founder, 'id' | 'createdAt'>[] {
    return (raw.founders ?? []).map((f: any) => ({
      companyId: raw.slug,   // Will be resolved to UUID in the repository
      name: f.full_name,
      linkedinUrl: f.linkedin_url ?? null,
      previousEmployers: [],
      schools: [],
    }))
  }

  private normalizeStatus(raw: string): CompanyStatus {
    const map: Record<string, CompanyStatus> = {
      'Active': 'Active',
      'Public': 'Active',
      'Acquired': 'Acquired',
      'Inactive': 'Inactive',
    }
    return map[raw] ?? 'Active'
  }
}
```

**How to verify this task is complete:**

```bash
# Create a quick integration test
# packages/core/src/pipeline/fetchers/__tests__/YCFetcher.integration.test.ts

it('fetches at least 3000 companies from YC API', async () => {
  // This hits the real API — tag this test as [integration] to exclude from CI
  const fetcher = new YCFetcher(companyRepo, founderRepo)
  const result = await fetcher.run()
  expect(result.companies).toBeGreaterThan(3000)
  expect(result.founders).toBeGreaterThan(5000)
}, 300_000)   // 5 minute timeout

# Run only this test manually (not in CI)
pnpm vitest run --reporter verbose src/pipeline/fetchers/__tests__/YCFetcher.integration.test.ts

# After run, verify in database:
docker exec yc_postgres psql -U yc_user -d yc_intelligence \
  -c "SELECT COUNT(*) FROM companies; SELECT COUNT(*) FROM founders;"
# Expected: companies >= 3000, founders >= 5000
```

---

### Task 2.3 — Job Board Fetcher

**Goal:** For each active company, try Greenhouse → Lever → Ashby in order. Store all active jobs with extracted tech stack.

**Steps:**

```typescript
// packages/core/src/pipeline/fetchers/JobBoardFetcher.ts

export class JobBoardFetcher {
  private client = createHttpClient(undefined, { delayMs: 300 })

  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly jobRepo: IJobRepository,
  ) {}

  async run(): Promise<{ processed: number; jobsFound: number }> {
    const { data: companies } = await this.companyRepo.search({
      status: 'Active',
      limit: 10000,
    })

    let jobsFound = 0
    let processed = 0

    // Process in batches of PIPELINE_CONCURRENCY to avoid hammering ATS APIs
    for (const batch of chunk(companies, config.PIPELINE_CONCURRENCY)) {
      await Promise.allSettled(
        batch.map(async (company) => {
          const jobs = await this.fetchJobsForCompany(company)
          if (jobs.length > 0) {
            await this.jobRepo.upsertMany(jobs)
            await this.jobRepo.markInactiveForCompany(
              company.id,
              jobs.map(j => j.applyUrl)
            )
            jobsFound += jobs.length
          }
          processed++
        })
      )
    }

    return { processed, jobsFound }
  }

  private async fetchJobsForCompany(company: Company): Promise<Omit<Job, 'id' | 'fetchedAt'>[]> {
    const slug = this.deriveSlug(company)
    
    for (const fetcher of [this.fetchGreenhouse, this.fetchLever, this.fetchAshby]) {
      try {
        const jobs = await fetcher.call(this, slug, company.id)
        if (jobs.length > 0) return jobs
      } catch {
        // Try next ATS
      }
    }
    return []
  }

  private async fetchGreenhouse(slug: string, companyId: string): Promise<Job[]> {
    const res = await this.client.get(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
    )
    return (res.data.jobs ?? []).map((j: any) => ({
      companyId,
      title: j.title,
      location: j.location?.name ?? null,
      isRemote: j.location?.name?.toLowerCase().includes('remote') ?? false,
      description: j.content ?? null,
      techStack: extractTechStack(j.content ?? ''),
      atsSource: 'greenhouse' as ATSSource,
      applyUrl: j.absolute_url,
      isActive: true,
      postedAt: j.updated_at ? new Date(j.updated_at) : null,
    }))
  }
  
  // Similar for fetchLever() and fetchAshby()
}
```

**How to verify this task is complete:**

```bash
# After running fetcher, check database
docker exec yc_postgres psql -U yc_user -d yc_intelligence \
  -c "SELECT ats_source, COUNT(*) FROM jobs GROUP BY ats_source;"
# Expected: rows for greenhouse, lever, ashby each with > 100 jobs

docker exec yc_postgres psql -U yc_user -d yc_intelligence \
  -c "SELECT COUNT(DISTINCT company_id) FROM jobs WHERE is_active = true;"
# Expected: > 300 companies with active jobs

# Check tech stack extraction worked
docker exec yc_postgres psql -U yc_user -d yc_intelligence \
  -c "SELECT title, tech_stack FROM jobs WHERE array_length(tech_stack, 1) > 0 LIMIT 5;"
# Expected: Jobs with tech_stack arrays like ["typescript", "react", "postgresql"]
```

---

### Task 2.4 — Tech Stack Extractor

**Goal:** Parse job description text and return a normalized array of technology keywords. Handles casing variations ("TypeScript", "typescript", "TS") and common aliases.

**Steps:**

```typescript
// packages/core/src/lib/techExtractor.ts

const TECH_KEYWORDS: Record<string, string> = {
  // Normalize aliases → canonical form
  'typescript': 'typescript', 'ts': 'typescript',
  'javascript': 'javascript', 'js': 'javascript',
  'python': 'python', 'py': 'python',
  'golang': 'go', 'go': 'go',
  'rust': 'rust',
  'java': 'java', 'kotlin': 'kotlin',
  'ruby': 'ruby', 'ruby on rails': 'rails', 'rails': 'rails',
  'react': 'react', 'reactjs': 'react', 'react.js': 'react',
  'next.js': 'nextjs', 'nextjs': 'nextjs',
  'node': 'nodejs', 'node.js': 'nodejs', 'nodejs': 'nodejs',
  'postgresql': 'postgresql', 'postgres': 'postgresql',
  'mysql': 'mysql', 'mongodb': 'mongodb',
  'redis': 'redis', 'elasticsearch': 'elasticsearch',
  'kubernetes': 'kubernetes', 'k8s': 'kubernetes',
  'docker': 'docker', 'aws': 'aws', 'gcp': 'gcp', 'azure': 'azure',
  'graphql': 'graphql', 'grpc': 'grpc',
  'terraform': 'terraform', 'kafka': 'kafka',
}

// Regex built once at module load — not on every call
const TECH_PATTERN = new RegExp(
  `\\b(${Object.keys(TECH_KEYWORDS).map(escapeRegex).join('|')})\\b`,
  'gi'
)

export function extractTechStack(text: string): string[] {
  const found = new Set<string>()
  const matches = text.matchAll(TECH_PATTERN)
  for (const match of matches) {
    const canonical = TECH_KEYWORDS[match[1].toLowerCase()]
    if (canonical) found.add(canonical)
  }
  return Array.from(found).sort()
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

**How to verify this task is complete:**

```bash
# packages/core/src/lib/__tests__/techExtractor.test.ts

import { extractTechStack } from '../techExtractor'

const cases = [
  {
    input: "We use TypeScript, React, and Node.js. Our backend runs on PostgreSQL.",
    expected: ['nodejs', 'postgresql', 'react', 'typescript'],
  },
  {
    input: "Experience with K8s, AWS, and Golang required.",
    expected: ['aws', 'go', 'kubernetes'],
  },
  {
    input: "No tech mentioned here.",
    expected: [],
  },
  {
    input: "typescript TypeScript TS ts — all the same",
    expected: ['typescript'],   // Deduped and canonical
  },
]

cases.forEach(({ input, expected }) => {
  it(`extracts from: "${input.slice(0, 40)}..."`, () => {
    expect(extractTechStack(input)).toEqual(expected)
  })
})

pnpm vitest run src/lib/__tests__/techExtractor.test.ts
# Expected: All 4 tests pass
```

---

### Task 2.5 — HN Fetcher

**Goal:** For each company, fetch relevant HN posts (Show HN launches, hiring mentions). Also parse the monthly "Who is Hiring?" threads for structured job signals.

**Steps:**

```typescript
// packages/core/src/pipeline/fetchers/HNFetcher.ts

const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1'

export class HNFetcher {
  private client = createHttpClient(HN_SEARCH_URL)

  async fetchForCompany(company: Company): Promise<HNPost[]> {
    const [launches, hiringMentions] = await Promise.all([
      this.searchLaunches(company.name),
      this.searchHiring(company.name),
    ])
    return [...launches, ...hiringMentions].map(raw => this.toPost(raw, company.id))
  }

  private async searchLaunches(name: string) {
    const res = await this.client.get('/search', {
      params: {
        query: `Show HN ${name}`,
        tags: 'story',
        hitsPerPage: 10,
      },
    })
    return res.data.hits ?? []
  }

  private toPost(raw: any, companyId: string): Omit<HNPost, 'id' | 'fetchedAt'> {
    const ageInDays = Math.max(1,
      (Date.now() - new Date(raw.created_at).getTime()) / 86_400_000
    )
    return {
      companyId,
      hnId: String(raw.objectID),
      title: raw.title,
      url: raw.url ?? null,
      hnUrl: `https://news.ycombinator.com/item?id=${raw.objectID}`,
      points: raw.points ?? 0,
      commentCount: raw.num_comments ?? 0,
      postType: this.classifyPost(raw.title),
      sentimentScore: (raw.points + (raw.num_comments ?? 0) * 2) / ageInDays,
      postedAt: new Date(raw.created_at),
    }
  }

  private classifyPost(title: string): HNPostType {
    if (title.startsWith('Show HN')) return 'Show HN'
    if (title.startsWith('Ask HN')) return 'Ask HN'
    if (title.toLowerCase().includes('hiring')) return 'Hiring'
    return 'Other'
  }
}
```

**How to verify this task is complete:**

```bash
# Quick smoke test — no DB needed
node -e "
  const { HNFetcher } = require('./packages/core/dist/pipeline/fetchers/HNFetcher')
  const fetcher = new HNFetcher()
  fetcher.fetchForCompany({ id: 'test', name: 'Stripe', slug: 'stripe' })
    .then(posts => {
      console.log('Posts found:', posts.length)
      console.log('Sample:', JSON.stringify(posts[0], null, 2))
    })
"
# Expected: posts.length >= 1
# Sample post has: hnId, title, points, commentCount, sentimentScore fields
```

---

## Phase 3 — Service Layer

### Task 3.1 — CompanyService

**Goal:** The primary business logic layer for company queries. MCP tools and API routes both call this. It orchestrates repository calls and applies business rules (e.g., "dead companies excluded by default").

**Steps:**

```typescript
// packages/core/src/services/CompanyService.ts

import type { ICompanyRepository } from '../repositories/ICompanyRepository'
import type { IJobRepository } from '../repositories/IJobRepository'
import type { EmbeddingService } from './EmbeddingService'
import type { Company, CompanyWithRelations } from '../domain'

export interface SearchCompaniesInput {
  query?: string
  batch?: string
  status?: string
  industry?: string
  isHiring?: boolean
  limit?: number
  offset?: number
}

export interface SemanticSearchInput {
  query: string
  limit?: number
  filter?: Partial<SearchCompaniesInput>
}

export class CompanyService {
  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async search(input: SearchCompaniesInput): Promise<{ data: Company[]; total: number }> {
    // Business rule: exclude dead companies by default
    const status = (input.status as any) ?? 'Active'
    return this.companyRepo.search({ ...input, status, limit: Math.min(input.limit ?? 20, 100) })
  }

  async getByName(name: string): Promise<CompanyWithRelations | null> {
    // Try exact slug match first, then fuzzy
    const slug = slugify(name)
    const exact = await this.companyRepo.findBySlugWithRelations(slug)
    if (exact) return exact

    // Fuzzy: search by name and return closest match
    const { data } = await this.companyRepo.search({ query: name, limit: 1 })
    if (!data[0]) return null
    return this.companyRepo.findBySlugWithRelations(data[0].slug)
  }

  async semanticSearch(input: SemanticSearchInput): Promise<Array<Company & { similarity: number }>> {
    const embedding = await this.embeddingService.embed(input.query)
    const limit = Math.min(input.limit ?? 10, 50)
    return this.companyRepo.findBySemanticSimilarity(embedding, limit)
  }
}
```

**How to verify this task is complete:**

```bash
# Unit test with in-memory mock repository (no database needed)
# packages/core/src/services/__tests__/CompanyService.test.ts

class MockCompanyRepository implements ICompanyRepository {
  private data: Company[] = []
  async search(params) {
    let filtered = this.data
    if (params.batch) filtered = filtered.filter(c => c.batch === params.batch)
    if (params.status) filtered = filtered.filter(c => c.status === params.status)
    return { data: filtered.slice(0, params.limit ?? 20), total: filtered.length }
  }
  // ... other methods
}

it('excludes dead companies by default', async () => {
  const repo = new MockCompanyRepository()
  repo.seed([
    { slug: 'active-co', status: 'Active' },
    { slug: 'dead-co', status: 'Dead' },
  ])
  const service = new CompanyService(repo, mockEmbeddingService)
  const { data } = await service.search({})
  expect(data.every(c => c.status !== 'Dead')).toBe(true)
})

it('caps limit at 100', async () => {
  const service = new CompanyService(repo, mockEmbeddingService)
  const { data } = await service.search({ limit: 999 })
  expect(data.length).toBeLessThanOrEqual(100)
})

pnpm vitest run src/services/__tests__/CompanyService.test.ts
# Expected: Both tests pass, zero database calls made
```

---

### Task 3.2 — EmbeddingService

**Goal:** Generate and cache vector embeddings for semantic search. Batch requests to stay within Voyage rate limits.

**Steps:**

```typescript
// packages/core/src/services/EmbeddingService.ts

import { VoyageEmbeddingProvider } from '../lib/embeddingProvider'
import { createLogger } from '../lib/logger'
import type { PrismaClient } from '@prisma/client'

const logger = createLogger('EmbeddingService')
const MODEL = 'voyage-3.5'
const BATCH_SIZE = 100

export class EmbeddingService {
  private embeddingProvider = new VoyageEmbeddingProvider({ apiKey: config.VOYAGE_API_KEY })

  constructor(private readonly prisma: PrismaClient) {}

  // Embed a single query string (used at query time)
  async embed(text: string): Promise<number[]> {
    const res = await this.openai.embeddings.create({
      model: MODEL,
      input: text.slice(0, 8191),   // API limit
    })
    return res.data[0].embedding
  }

  // Generate and store embeddings for all companies without one
  async generateMissing(): Promise<number> {
    const companies = await this.prisma.$queryRaw<{ id: string; name: string; description: string; tags: string[] }[]>`
      SELECT c.id, c.name, c.description, c.tags
      FROM companies c
      LEFT JOIN company_embeds e ON e.company_id = c.id
      WHERE e.id IS NULL AND c.status = 'Active'
    `

    logger.info({ count: companies.length }, 'Generating embeddings for companies')
    let generated = 0

    for (const batch of chunk(companies, BATCH_SIZE)) {
      const texts = batch.map(c =>
        `${c.name}. ${c.description ?? ''}. Tags: ${c.tags.join(', ')}`
      )
      const res = await this.openai.embeddings.create({ model: MODEL, input: texts })

      for (let i = 0; i < batch.length; i++) {
        const vector = `[${res.data[i].embedding.join(',')}]`
        await this.prisma.$executeRaw`
          INSERT INTO company_embeds (id, company_id, embedding)
          VALUES (gen_random_uuid(), ${batch[i].id}, ${vector}::vector)
          ON CONFLICT (company_id) DO UPDATE SET embedding = ${vector}::vector
        `
      }
      generated += batch.length
      logger.info({ generated, total: companies.length }, 'Embedding progress')
    }

    return generated
  }
}
```

**How to verify this task is complete:**

```bash
# Run against real DB with a few seed companies
node -e "
  const { EmbeddingService } = require('./packages/core/dist/services/EmbeddingService')
  const service = new EmbeddingService(prisma)
  service.generateMissing().then(n => console.log('Generated:', n))
"
# Expected: "Generated: X" where X = number of companies without embeddings

# Verify semantic search works after embedding
docker exec yc_postgres psql -U yc_user -d yc_intelligence \
  -c "SELECT COUNT(*) FROM company_embeds;"
# Expected: Same count as active companies

# Manual semantic test
node -e "
  const service = new CompanyService(companyRepo, embeddingService)
  service.semanticSearch({ query: 'developer tools for databases' })
    .then(results => results.forEach(r => console.log(r.name, r.similarity.toFixed(3))))
"
# Expected: Database-adjacent companies (Supabase, PlanetScale, etc.) appear first
# Similarity scores should be > 0.7 for relevant companies
```

---

## Phase 4 — MCP Package

### Task 4.1 — MCP Server Scaffold

**Goal:** A working MCP server that Claude can connect to. No tools yet — just the scaffold with service wiring.

**Steps:**

```bash
cd packages/mcp
pnpm add @modelcontextprotocol/sdk @yc-intelligence/core
pnpm add -D typescript @types/node
```

```typescript
// packages/mcp/src/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { PrismaClient } from '@prisma/client'
import {
  PrismaCompanyRepository,
  PrismaJobRepository,
  PrismaFounderRepository,
  PrismaHNRepository,
  CompanyService,
  JobService,
  FounderService,
  HNService,
  EmbeddingService,
} from '@yc-intelligence/core'

// Wire up dependencies (manual DI — no framework needed at this scale)
const prisma = new PrismaClient()
const companyRepo = new PrismaCompanyRepository(prisma)
const jobRepo = new PrismaJobRepository(prisma)
const founderRepo = new PrismaFounderRepository(prisma)
const hnRepo = new PrismaHNRepository(prisma)
const embeddingService = new EmbeddingService(prisma)

export const services = {
  company: new CompanyService(companyRepo, embeddingService),
  job: new JobService(jobRepo, companyRepo),
  founder: new FounderService(founderRepo),
  hn: new HNService(hnRepo),
}

const server = new McpServer({
  name: 'yc-intelligence',
  version: '1.0.0',
})

// Tools registered here in Tasks 4.2 - 4.7
// import { registerSearchCompanies } from './tools/searchCompanies'
// registerSearchCompanies(server, services)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('YC Intelligence MCP server running')   // stderr, not stdout
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
```

**How to verify this task is complete:**

```bash
# Build the package
cd packages/mcp && pnpm build

# Run the server — it should start without errors
node dist/index.js
# Expected: "YC Intelligence MCP server running" printed to stderr
# Process stays alive (it's a stdio server waiting for connections)
# Press Ctrl+C to stop — no crash, clean exit

# Test MCP connection via the SDK inspector
npx @modelcontextprotocol/inspector node dist/index.js
# Expected: Inspector connects, shows server name "yc-intelligence"
#           No tools listed yet (that's Tasks 4.2-4.7)
```

---

### Task 4.2 — Tool: `search_companies`

**Goal:** Claude can ask "find YC devtools companies in W24 that are hiring" and get a structured list back.

**Steps:**

```typescript
// packages/mcp/src/tools/searchCompanies.ts

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Services } from '../index'
import { formatCompanyList } from '../formatters/companyFormatter'

const SearchCompaniesInput = z.object({
  query: z.string().optional().describe('Text search on name and description'),
  batch: z.string().optional().describe('YC batch e.g. W24, S23, W22'),
  industry: z.string().optional().describe('Industry tag e.g. Fintech, Climate, Developer Tools'),
  isHiring: z.boolean().optional().describe('Only return companies currently hiring'),
  limit: z.number().min(1).max(100).default(20),
})

export function registerSearchCompanies(server: McpServer, services: Services) {
  server.tool(
    'search_companies',
    'Search and filter YC companies by batch, industry, hiring status, or keyword',
    SearchCompaniesInput.shape,
    async (input) => {
      const result = await services.company.search(input)

      return {
        content: [
          {
            type: 'text',
            text: formatCompanyList(result.data, result.total),
          },
        ],
      }
    }
  )
}

// packages/mcp/src/formatters/companyFormatter.ts
export function formatCompanyList(companies: Company[], total: number): string {
  const lines = [
    `Found ${total} companies (showing ${companies.length}):`,
    '',
    ...companies.map(c => [
      `**${c.name}** (${c.batch ?? 'Unknown batch'})`,
      `  ${c.shortDescription ?? c.description?.slice(0, 120) ?? 'No description'}`,
      `  Status: ${c.status} | Hiring: ${c.isHiring ? 'Yes ✓' : 'No'} | ${c.website ?? ''}`,
    ].join('\n')),
  ]
  return lines.join('\n')
}
```

**How to verify this task is complete:**

```bash
# Via MCP Inspector
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js

# In inspector, call search_companies with:
{ "batch": "W24", "isHiring": true, "limit": 5 }

# Expected response contains:
# - "Found X companies (showing 5)"
# - 5 company entries with name, batch, description, website
# - All companies have batch = "W24"
# - All companies have "Hiring: Yes ✓"

# Also test empty results
{ "batch": "W99" }
# Expected: "Found 0 companies (showing 0)"
# No error, no crash
```

---

### Task 4.3 — Tool: `search_jobs`

**Goal:** "Find YC companies hiring senior Rust engineers who are remote-friendly" returns actual open job postings.

**Steps:**

```typescript
// packages/mcp/src/tools/searchJobs.ts

const SearchJobsInput = z.object({
  techStack: z.array(z.string()).optional()
    .describe('Tech keywords to match e.g. ["rust", "postgresql", "kubernetes"]'),
  title: z.string().optional().describe('Job title keyword e.g. "Senior Software Engineer"'),
  isRemote: z.boolean().optional().describe('Filter to remote-friendly roles only'),
  batch: z.string().optional().describe('Only jobs from companies in this YC batch'),
  industry: z.string().optional().describe('Only jobs from companies in this industry'),
  limit: z.number().default(20),
})

// Tool handler calls services.job.search(input)
// Formatter returns: company name, job title, location, tech stack, apply URL, posted date
```

**How to verify this task is complete:**

```bash
# Test 1: Tech stack filter
{ "techStack": ["rust"], "limit": 5 }
# Expected: All returned jobs have "rust" in their techStack array

# Test 2: Remote filter
{ "isRemote": true, "title": "backend", "limit": 5 }
# Expected: Jobs where isRemote = true, title contains "backend"

# Test 3: Combined filter
{ "techStack": ["typescript", "react"], "batch": "W24", "isRemote": true }
# Expected: Jobs matching ALL three criteria
# If 0 results returned, verify test DB has this data
```

---

### Task 4.4 — Tool: `get_company_detail`

**Goal:** "Tell me everything about Linear" returns a complete profile: description, founders, open jobs, HN posts, funding.

**Steps:**

```typescript
// packages/mcp/src/tools/getCompanyDetail.ts

const GetCompanyDetailInput = z.object({
  name: z.string().describe('Company name (fuzzy matched, e.g. "Linear", "Stripe", "Airbnb")'),
})

// Handler calls services.company.getByName(input.name)
// Returns formatted CompanyWithRelations

// Formatter builds a rich markdown-like output:
// ## Linear (S19)
// Status: Active | Team: 51-200 | Hiring: Yes
// 
// **About:** Linear is a project management tool...
// 
// **Founders:**
// - Karri Saarinen (linkedin.com/in/...)
// 
// **Open Roles (3):**
// - Senior Software Engineer — Remote — TypeScript, React, PostgreSQL
//   Apply: https://linear.app/careers/...
// 
// **Recent HN Activity:**
// - Show HN: Linear — 847 pts, 312 comments (2 years ago)
// 
// **Funding:**
// - Series B: $35M (2022-04) — Sequoia Capital
```

**How to verify this task is complete:**

```bash
# Test 1: Known company by exact name
{ "name": "Stripe" }
# Expected: Full profile returned. Founders, jobs, HN posts all populated.

# Test 2: Fuzzy match
{ "name": "open ai" }   # Wrong casing, space vs no-space
# Expected: Returns relevant company profile (fuzzy match works)

# Test 3: Unknown company
{ "name": "ThisCompanyDoesNotExist123" }
# Expected: "Company 'ThisCompanyDoesNotExist123' not found." — no crash
```

---

### Task 4.5 — Tools: `search_founders`, `get_hn_activity`, `semantic_search`

**Goal:** Complete the remaining 3 MCP tools. Same pattern as above — Zod schema → service call → formatter.

**`search_founders` test:**
```bash
{ "previousEmployer": "Google", "limit": 5 }
# Expected: Founders who previously worked at Google, with their company names
```

**`get_hn_activity` test:**
```bash
{ "postType": "Show HN", "since": "2024-01-01", "limit": 10 }
# Expected: 10 Show HN posts from 2024 onward, sorted by sentimentScore DESC
```

**`semantic_search` test:**
```bash
{ "query": "AI-powered developer tools for code review", "limit": 5 }
# Expected: Companies semantically related to AI + dev tools + code review
# Similarity scores should be > 0.6
# Companies like Graphite, CodeRabbit, Trunk should appear if in dataset
```

---

## Phase 5 — REST API Package

> **Purpose:** This package future-proofs the project. When you want to build a web UI, these endpoints already exist. MCP and API share the same service layer — no duplication.

### Task 5.1 — Fastify Server + Dependency Injection

**Goal:** A Fastify server that boots cleanly, returns 200 on `/health`, and shares the exact same service instances as the MCP server (via the `core` package).

**Steps:**

```bash
cd packages/api
pnpm add fastify @fastify/cors @fastify/rate-limit @fastify/redis ioredis zod
pnpm add @yc-intelligence/core
```

```typescript
// packages/api/src/index.ts

import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import {
  PrismaCompanyRepository,
  CompanyService,
  EmbeddingService,
} from '@yc-intelligence/core'
import { companyRoutes } from './routes/companies'
import { jobRoutes } from './routes/jobs'

const app = Fastify({ logger: true })
const prisma = new PrismaClient()

// Same DI wiring as MCP package — same services, different adapters
const companyRepo = new PrismaCompanyRepository(prisma)
const embeddingService = new EmbeddingService(prisma)
const companyService = new CompanyService(companyRepo, embeddingService)

// Register routes with services injected
await app.register(companyRoutes, { prefix: '/api/v1', services: { company: companyService } })

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

await app.listen({ port: 3001, host: '0.0.0.0' })
```

**How to verify this task is complete:**

```bash
# Start the API server
cd packages/api && node dist/index.js &

# Test 1: Health endpoint
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"2024-..."}

# Test 2: Server accepts connections
curl -o /dev/null -s -w "%{http_code}" http://localhost:3001/health
# Expected: 200
```

---

### Task 5.2 — REST Routes: Companies & Jobs

**Goal:** `GET /api/v1/companies?batch=W24&isHiring=true` and `GET /api/v1/companies/:slug` work correctly, calling the same services as MCP.

**Steps:**

```typescript
// packages/api/src/routes/companies.ts

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const SearchQuerySchema = z.object({
  query: z.string().optional(),
  batch: z.string().optional(),
  industry: z.string().optional(),
  isHiring: z.coerce.boolean().optional(),
  limit: z.coerce.number().default(20),
  offset: z.coerce.number().default(0),
})

export const companyRoutes: FastifyPluginAsync = async (fastify, opts) => {
  const { company: companyService } = opts.services

  // GET /api/v1/companies?batch=W24&isHiring=true
  fastify.get('/companies', async (request, reply) => {
    const params = SearchQuerySchema.parse(request.query)
    const result = await companyService.search(params)
    return { data: result.data, total: result.total, limit: params.limit, offset: params.offset }
  })

  // GET /api/v1/companies/stripe
  fastify.get('/companies/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const company = await companyService.getByName(slug)
    if (!company) return reply.status(404).send({ error: 'Company not found' })
    return company
  })

  // GET /api/v1/companies/search/semantic?q=developer+tools+for+AI
  fastify.get('/companies/search/semantic', async (request, reply) => {
    const { q, limit } = request.query as { q: string; limit?: string }
    if (!q) return reply.status(400).send({ error: 'q parameter required' })
    const results = await companyService.semanticSearch({ query: q, limit: Number(limit ?? 10) })
    return { data: results }
  })
}
```

**How to verify this task is complete:**

```bash
# Test 1: List companies with filters
curl "http://localhost:3001/api/v1/companies?batch=W24&limit=3"
# Expected: JSON with data array of 3 companies, total count field

# Test 2: Get company by slug
curl "http://localhost:3001/api/v1/companies/stripe"
# Expected: Full company object with founders, jobs, hnPosts

# Test 3: 404 for unknown company
curl -o /dev/null -s -w "%{http_code}" \
  "http://localhost:3001/api/v1/companies/this-does-not-exist"
# Expected: 404

# Test 4: Semantic search
curl "http://localhost:3001/api/v1/companies/search/semantic?q=payments+infrastructure"
# Expected: Companies related to payments (Stripe, Brex, Ramp types)

# Test 5: Invalid params don't crash server
curl "http://localhost:3001/api/v1/companies?limit=not_a_number"
# Expected: Either 400 with validation error, OR Zod coerces and returns 200 (both acceptable)
```

---

### Task 5.3 — Redis Caching Middleware

**Goal:** Search queries are cached for 10 minutes. A cache hit responds in < 5ms. The cache is transparent — no changes needed to route handlers.

**Steps:**

```typescript
// packages/api/src/middleware/cache.ts

import type { FastifyRequest, FastifyReply } from 'fastify'
import type { Redis } from 'ioredis'

const TTL_SECONDS = 600  // 10 minutes

export function cacheMiddleware(redis: Redis) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Only cache GET requests
    if (request.method !== 'GET') return

    const cacheKey = `api:${request.url}`
    const cached = await redis.get(cacheKey)

    if (cached) {
      reply.header('X-Cache', 'HIT')
      reply.send(JSON.parse(cached))
      return
    }

    // Intercept the response to cache it
    const originalSend = reply.send.bind(reply)
    reply.send = (payload: any) => {
      if (reply.statusCode === 200) {
        redis.setex(cacheKey, TTL_SECONDS, JSON.stringify(payload))
      }
      reply.header('X-Cache', 'MISS')
      return originalSend(payload)
    }
  }
}
```

**How to verify this task is complete:**

```bash
# First request (cache miss)
time curl "http://localhost:3001/api/v1/companies?batch=W24"
# Note the response time (likely 100-500ms due to DB query)
# Check header: X-Cache: MISS

# Second request (cache hit)
time curl "http://localhost:3001/api/v1/companies?batch=W24"
# Expected: Response time < 20ms (Redis lookup)
# Check header: X-Cache: HIT

# Verify cache entry exists in Redis
docker exec yc_redis redis-cli keys "api:*"
# Expected: Shows cached keys like "api:/api/v1/companies?batch=W24"

# Verify TTL is set
docker exec yc_redis redis-cli ttl "api:/api/v1/companies?batch=W24"
# Expected: Number between 1 and 600 (seconds remaining)
```

---

## Phase 6 — Testing Strategy

### Task 6.1 — Unit Test Suite

**Goal:** Every service and utility has unit tests that run in < 5 seconds total with zero external dependencies (no DB, no network, no filesystem).

```
Test file locations:
  packages/core/src/services/__tests__/CompanyService.test.ts
  packages/core/src/services/__tests__/JobService.test.ts
  packages/core/src/lib/__tests__/techExtractor.test.ts
  packages/core/src/lib/__tests__/httpClient.test.ts
  packages/core/src/pipeline/transformers/__tests__/YCTransformer.test.ts

Test patterns:
  - Services: mock repositories with in-memory arrays
  - HTTP client: mock with nock
  - Transformers: pure input/output, no mocks needed
  - Extractors: pure functions, no mocks needed

Run:
  pnpm vitest run --project core
  
Pass criteria:
  - All tests pass
  - Total runtime < 5 seconds
  - No real network calls (nock intercepts all HTTP)
  - No database connections
```

---

### Task 6.2 — Integration Test Suite

**Goal:** Test the full stack from repository → service → database. Uses Docker Postgres. Each test file gets a clean database state.

```typescript
// packages/core/src/test-utils/testDb.ts

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

// Use a separate test database to never pollute dev data
const TEST_DB_URL = 'postgresql://yc_user:yc_password@localhost:5432/yc_test'

export async function setupTestDb() {
  process.env.DATABASE_URL = TEST_DB_URL
  execSync('npx prisma migrate deploy', { env: { DATABASE_URL: TEST_DB_URL } })
  return new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } })
}

export async function cleanDb(prisma: PrismaClient) {
  // Clean in FK-safe order
  await prisma.$transaction([
    prisma.companyEmbed.deleteMany(),
    prisma.hnPost.deleteMany(),
    prisma.job.deleteMany(),
    prisma.funding.deleteMany(),
    prisma.founder.deleteMany(),
    prisma.company.deleteMany(),
  ])
}
```

**Run:**

```bash
# Create test database
docker exec yc_postgres psql -U yc_user -c "CREATE DATABASE yc_test;"

# Run integration tests
pnpm vitest run --project core --reporter verbose tests/integration/

# Pass criteria:
# - All integration tests pass
# - Each test uses a clean DB (no cross-test contamination)
# - Total runtime < 30 seconds
```

---

### Task 6.3 — End-to-End MCP Test

**Goal:** Start the MCP server and verify all 6 tools respond correctly using the MCP SDK client.

```typescript
// packages/mcp/tests/e2e/tools.test.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn } from 'child_process'

describe('MCP Tools E2E', () => {
  let client: Client

  beforeAll(async () => {
    const server = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'inherit'] })
    const transport = new StdioClientTransport({ reader: server.stdout, writer: server.stdin })
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} })
    await client.connect(transport)
  })

  it('lists 6 tools', async () => {
    const { tools } = await client.listTools()
    expect(tools).toHaveLength(6)
    expect(tools.map(t => t.name)).toContain('search_companies')
    expect(tools.map(t => t.name)).toContain('semantic_search')
  })

  it('search_companies returns structured data', async () => {
    const result = await client.callTool('search_companies', { batch: 'W24', limit: 3 })
    const text = result.content[0].text
    expect(text).toContain('W24')
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')   // No raw nulls in output
  })

  it('get_company_detail handles unknown company gracefully', async () => {
    const result = await client.callTool('get_company_detail', {
      name: 'ZZZ_DOES_NOT_EXIST_ZZZ'
    })
    expect(result.content[0].text).toContain('not found')
    // Most important: no error thrown, no crash
  })
})
```

**Run:**

```bash
pnpm vitest run packages/mcp/tests/e2e/

# Pass criteria:
# - All tools listed correctly
# - search_companies returns valid formatted output
# - Unknown company returns "not found" message (no crash)
# - Total runtime < 10 seconds
```

---

## Phase 7 — CI/CD & DevEx

### Task 7.1 — GitHub Actions CI Pipeline

**Goal:** Every push and PR runs lint, type-check, and all tests. Red CI blocks merging to main.

**Steps:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: yc_user
          POSTGRES_PASSWORD: yc_password
          POSTGRES_DB: yc_intelligence
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-retries 5
        ports: ["5432:5432"]

      redis:
        image: redis:7-alpine
        options: --health-cmd "redis-cli ping"
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with: { version: 8 }

      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }

      - run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm turbo type-check

      - name: Lint
        run: pnpm turbo lint

      - name: Migrate test DB
        run: pnpm --filter @yc-intelligence/core prisma migrate deploy
        env:
          DATABASE_URL: postgresql://yc_user:yc_password@localhost:5432/yc_intelligence

      - name: Unit + Integration tests
        run: pnpm turbo test
        env:
          DATABASE_URL: postgresql://yc_user:yc_password@localhost:5432/yc_intelligence
          REDIS_URL: redis://localhost:6379
          VOYAGE_API_KEY: ${{ secrets.VOYAGE_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
```

**How to verify this task is complete:**

```bash
# Push a branch with a deliberate test failure
# Break one unit test, push, observe CI fails

# Fix the test, push again, observe CI passes

# Verify the badge works — add to README:
# ![CI](https://github.com/YOUR_USERNAME/yc-intelligence/actions/workflows/ci.yml/badge.svg)
```

---

### Task 7.2 — Pipeline CLI

**Goal:** Operators can run `pnpm pipeline:seed` to do a full first-time data load, or `pnpm pipeline:refresh` for a daily incremental refresh.

**Steps:**

```typescript
// packages/core/src/pipeline/cli.ts

import { PipelineOrchestrator } from './PipelineOrchestrator'

const command = process.argv[2]  // seed | refresh | companies | jobs | hn | github

const orchestrator = new PipelineOrchestrator(/* inject services */)

const commands: Record<string, () => Promise<void>> = {
  seed: () => orchestrator.runFull(),         // All sources, full fetch
  refresh: () => orchestrator.runIncremental(), // Only changed/new data
  companies: () => orchestrator.runYC(),
  jobs: () => orchestrator.runJobs(),
  hn: () => orchestrator.runHN(),
  github: () => orchestrator.runGitHub(),
  embed: () => orchestrator.runEmbeddings(),
}

const fn = commands[command]
if (!fn) {
  console.error(`Unknown command: ${command}`)
  console.error(`Valid: ${Object.keys(commands).join(', ')}`)
  process.exit(1)
}

fn()
  .then(() => { console.log(`✅ ${command} complete`); process.exit(0) })
  .catch((err) => { console.error(`❌ ${command} failed:`, err); process.exit(1) })
```

```json
// packages/core/package.json scripts
{
  "pipeline:seed": "node dist/pipeline/cli.js seed",
  "pipeline:refresh": "node dist/pipeline/cli.js refresh",
  "pipeline:embed": "node dist/pipeline/cli.js embed"
}
```

**How to verify this task is complete:**

```bash
# Run seed from scratch
pnpm --filter @yc-intelligence/core pipeline:seed

# Monitor output — should log progress for each source:
# [YCFetcher] Page 1 fetched: 100 companies
# [YCFetcher] Page 2 fetched: 100 companies
# ...
# [JobBoardFetcher] Processed 3000/4000 companies
# ✅ seed complete

# Verify final counts
docker exec yc_postgres psql -U yc_user -d yc_intelligence \
  -c "SELECT 'companies' as t, COUNT(*) FROM companies
      UNION ALL SELECT 'jobs', COUNT(*) FROM jobs
      UNION ALL SELECT 'hn_posts', COUNT(*) FROM hn_posts
      UNION ALL SELECT 'founders', COUNT(*) FROM founders;"

# Expected minimums:
# companies | 3000+
# jobs      | 1000+
# hn_posts  | 500+
# founders  | 5000+
```

---

## 12. Dependency Map

```
packages/web        (future Next.js app)
    ↓ calls
packages/api        (Fastify REST API)
    ↓ imports
packages/core       (ALL business logic lives here)
    ↓ owns
  domain/           (pure types)
  repositories/     (interfaces + Prisma implementations)
  services/         (business logic)
  pipeline/         (data fetching)
  lib/              (utilities)

packages/mcp        (Claude MCP server)
    ↓ imports
packages/core       (same core, different adapter)


Build order enforced by Turborepo:
  core → mcp (parallel)
  core → api (parallel)
  api → web
```

### The Key Rule

```
✅ mcp imports core
✅ api imports core  
✅ web imports nothing (calls api over HTTP)

❌ core must NEVER import mcp or api
❌ mcp must NEVER import api
❌ Any circular dependency is a design failure
```

---

*This architecture means: when you're ready to launch a web app, you add `packages/web`, point it at `packages/api`, and the entire data layer is already production-ready.*
