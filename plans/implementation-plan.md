# YC Company Intelligence MCP — Project Implementation Plan

> **Document Type:** Product & Engineering Spec  
> **Version:** 1.0  
> **Status:** Ready for Implementation  

---

## Table of Contents

1. [Context — What Are We Building?](#1-context)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [Features Inventory](#3-features-inventory)
4. [Data Sources](#4-data-sources)
5. [System Architecture](#5-system-architecture)
6. [Tech Stack](#6-tech-stack)
7. [Implementation Plan — Phase by Phase](#7-implementation-plan)
8. [MCP Tools Specification](#8-mcp-tools-specification)
9. [Database Schema](#9-database-schema)
10. [Risk & Mitigation](#10-risk--mitigation)
11. [Launch Checklist](#11-launch-checklist)

---

## 1. Context

### What Are We Building?

**YC Company Intelligence MCP** is a Model Context Protocol server that gives Claude deep, queryable knowledge about the entire Y Combinator ecosystem — all ~4,000 companies across every batch, industry, and stage.

Instead of Claude guessing or hallucinating facts about YC startups, this MCP provides **real, up-to-date, structured data** that Claude can reason over in natural language.

### The Problem It Solves

Today, anyone researching YC companies has to:
- Manually browse ycombinator.com/companies
- Cross-reference Crunchbase for funding
- Search LinkedIn for founders
- Scan Hacker News manually for launches
- Check 5 different job boards for openings

This MCP **collapses all of that into a single conversation with Claude.**

### The Primary User

A software engineer (you) who wants to:
1. Identify the best YC startups to apply to
2. Research companies deeply before interviews
3. Understand the YC ecosystem to think and talk like an insider
4. Demonstrate product thinking and technical depth to hiring managers

### Example Queries This MCP Will Answer

```
"Which YC W24 companies in developer tools are hiring senior SWEs 
 with Rust or Go experience and have raised Series A?"

"Show me YC climate tech companies founded by ex-Google engineers 
 that launched on Hacker News in the last 6 months."

"What are the fastest-growing YC companies by headcount 
 in the last year, outside of AI?"

"Which YC companies pivoted recently? What were they before?"

"Find me YC companies where the founder previously worked at Stripe."
```

---

## 2. Goals & Success Metrics

### Primary Goals

| Goal | Description |
|------|-------------|
| **Coverage** | Index ≥ 95% of active YC companies |
| **Freshness** | Data refreshed every 24 hours |
| **Query Speed** | Any MCP tool responds in < 3 seconds |
| **Query Accuracy** | Claude answers questions correctly ≥ 90% of the time |
| **Depth** | At least 8 data points per company |

### What "Done" Looks Like

- Claude can answer any YC research question without hallucinating
- Job search queries return real, current openings with tech stacks
- The project README has a compelling demo GIF
- The repo is publishable and forkable by others

---

## 3. Features Inventory

### Must-Have Features (MVP)

| # | Feature | Description |
|---|---------|-------------|
| F-01 | Company Search | Search companies by name, industry, batch, status |
| F-02 | Job Search | Find open roles by tech stack, seniority, location |
| F-03 | Founder Lookup | Search by founder background, previous employer, school |
| F-04 | Batch Browser | Browse all companies in a specific YC batch |
| F-05 | Industry Filter | Filter by vertical (fintech, climate, devtools, etc.) |
| F-06 | HN Launch Feed | Surface recent Hacker News launches per company |
| F-07 | Company Detail | Full profile: description, stage, team size, website |
| F-08 | Data Refresh | CLI command to re-fetch and update all data |

### Should-Have Features (V1.1)

| # | Feature | Description |
|---|---------|-------------|
| F-09 | Funding Filter | Filter by raise amount, round stage, recency |
| F-10 | Tech Stack Detection | Infer stack from job postings + GitHub |
| F-11 | Pivot Detection | Flag companies whose description changed significantly |
| F-12 | HN Sentiment | Score community reception from upvotes/comments |
| F-13 | Growth Signal | Headcount trend from LinkedIn / job posting volume |
| F-14 | Semantic Search | Natural language search across all company descriptions |

### Nice-to-Have Features (V2)

| # | Feature | Description |
|---|---------|-------------|
| F-15 | Investor Graph | Which investors back which companies |
| F-16 | Alumni Network | Track where YC founders worked before/after |
| F-17 | Batch Comparison | Compare stats across batches (W22 vs S23 vs W24) |
| F-18 | Company Timeline | Chronological history of launches, pivots, raises |
| F-19 | Similar Companies | "Find me companies like Stripe" |
| F-20 | Alert System | Notify when a target company posts a new job |

---

## 4. Data Sources

### Source 1 — YC Public API ✅ Free, No Auth

```
Base URL: https://api.ycombinator.com/v0.1/companies
```

**What it provides:**
- Company name, one-liner, description
- Batch (W24, S23, etc.), status (Active / Acquired / Dead)
- Industry tags, subindustry
- Location, website URL
- Founder names and LinkedIn URLs
- Team size range
- `isHiring` boolean flag

**Fetch strategy:** Paginate through all results, store full JSON. Re-fetch nightly.

**Reliability:** High — official source, stable schema.

---

### Source 2 — Hacker News Algolia API ✅ Free, No Auth

```
Base URL: https://hn.algolia.com/api/v1/search
```

**What it provides:**
- "Show HN" launch posts for each company
- "Who Is Hiring?" monthly threads (job details + tech stacks)
- Community upvotes and comment counts (sentiment signal)
- Pivot announcements and re-launches
- Founder AMAs and Q&A threads

**Fetch strategy:** For each company, query by name + "Show HN". Also parse the monthly hiring threads to extract structured job postings.

**Reliability:** High — Algolia indexes all HN posts reliably.

---

### Source 3 — Job Board APIs ✅ Free, No Auth

Three ATS platforms cover ~80% of YC company job postings:

```
Greenhouse:  https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
Lever:       https://api.lever.co/v0/postings/{slug}?mode=json
Ashby:       https://api.ashbyhq.com/posting-public/job-board/{slug}
```

**What it provides:**
- Job title, department, location
- Full job description (tech stack, requirements, responsibilities)
- Remote/hybrid/onsite flag
- Date posted
- Direct application URL

**Fetch strategy:** For each company, try all three ATS endpoints. Store whichever returns results. Parse description text to extract tech keywords (Rust, Go, Python, React, etc.).

**Reliability:** High for companies using these ATS platforms. ~20% of companies use custom job pages (handle with Playwright fallback).

---

### Source 4 — GitHub API ✅ Free, 5,000 req/hr with token

```
Base URL: https://api.github.com/orgs/{org}
```

**What it provides:**
- Repository list and languages used (tech stack proof)
- Star counts, fork counts (open source activity)
- Last commit date (is the company actively building?)
- Number of contributors (engineering team size proxy)
- README content (often contains job links)

**Fetch strategy:** Match company name to GitHub org name (fuzzy match + manual mapping for ambiguous cases). Pull top 10 repos per org.

**Reliability:** Medium — not all companies have a public GitHub org.

---

### Source 5 — SEC EDGAR ✅ Free, No Auth

```
Base URL: https://efts.sec.gov/LATEST/search-index?q=%22Y+Combinator%22&forms=D
```

**What it provides:**
- Form D filings = legally verified fundraise announcements
- Exact raise amount and date
- Investor names
- Equity vs. debt flag

**Fetch strategy:** Search for filings mentioning "Y Combinator" as investor. Match by company name. Use as ground-truth funding data.

**Reliability:** High for US-based companies. Does not cover international or undisclosed rounds.

---

### Source 6 — Crunchbase (Optional, Paid)

```
Tier:     Basic API — $29/month
Base URL: https://api.crunchbase.com/api/v4/entities/organizations/{slug}
```

**What it provides:**
- Funding rounds with amounts, dates, lead investors
- Acquisition history
- Executive team changes
- Total funding raised

**Decision:** Start without it. EDGAR covers US funding. Add Crunchbase in V1.1 if funding data gaps are significant.

---

### Source Map Summary

| Source | Cost | Auth | Primary Value | Refresh |
|--------|------|------|---------------|---------|
| YC API | Free | None | Company list, founder names, tags | Daily |
| HN Algolia | Free | None | Launches, sentiment, hiring posts | Daily |
| Greenhouse/Lever/Ashby | Free | None | Job postings, tech stacks | Daily |
| GitHub API | Free | Token | Tech stack, engineering activity | Weekly |
| SEC EDGAR | Free | None | Funding amounts and dates | Weekly |
| Crunchbase | $29/mo | API Key | Full funding history | Weekly |

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE                            │
│                                                                 │
│  [YC API] [HN API] [Job Boards] [GitHub] [EDGAR]               │
│       │        │         │          │       │                   │
│       └────────┴─────────┴──────────┴───────┘                  │
│                          │                                      │
│                    ETL / Normalizer                             │
│              (fetch → clean → dedupe → store)                   │
│                          │                                      │
│              ┌───────────┴───────────┐                         │
│              │                       │                         │
│         PostgreSQL              Chroma DB                       │
│       (structured data)      (vector embeddings)               │
│    companies, jobs, people    semantic search index             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│                         MCP SERVER                              │
│                      (TypeScript / Node)                        │
│                                                                 │
│   search_companies()       get_company_jobs()                   │
│   get_company_detail()     search_by_tech_stack()               │
│   search_founders()        get_hn_activity()                    │
│   get_funding_info()       semantic_search()                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                          Claude (MCP Client)
                   "Which YC companies are hiring Rust devs?"
```

---

## 6. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| MCP Server | TypeScript + Node.js | Official MCP SDK is TS-first |
| MCP SDK | `@modelcontextprotocol/sdk` | Official, well-documented |
| Database | PostgreSQL + pgvector | Structured + vector search in one DB |
| ORM | Prisma | Type-safe, great DX |
| HTTP Client | Axios | Simple, reliable |
| Scraping Fallback | Playwright | For job pages not on standard ATS |
| Scheduler | node-cron | Nightly data refresh |
| Embeddings | Voyage `voyage-3.5` | Anthropic-recommended embedding provider, fast, good quality |
| Env Management | dotenv | Standard |
| Testing | Vitest | Fast, TS-native |
| Linting | ESLint + Prettier | Code quality |

---

## 7. Implementation Plan

### Phase 0 — Setup & Scaffolding
**Estimated Time: 2–3 hours**

---

#### Task 0.1 — Initialize the Project

```bash
mkdir yc-intelligence-mcp && cd yc-intelligence-mcp
npm init -y
npm install @modelcontextprotocol/sdk axios dotenv prisma @prisma/client
npm install -D typescript ts-node @types/node vitest eslint prettier
npx tsc --init
npx prisma init
```

**Deliverable:** Runnable TypeScript project with MCP SDK installed.

---

#### Task 0.2 — Set Up Project Structure

```
yc-intelligence-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/                # One file per MCP tool
│   │   ├── searchCompanies.ts
│   │   ├── getCompanyDetail.ts
│   │   ├── getCompanyJobs.ts
│   │   ├── searchFounders.ts
│   │   ├── getHNActivity.ts
│   │   └── semanticSearch.ts
│   ├── pipeline/             # Data fetching & ETL
│   │   ├── fetchYC.ts
│   │   ├── fetchJobs.ts
│   │   ├── fetchHN.ts
│   │   ├── fetchGitHub.ts
│   │   └── scheduler.ts
│   ├── db/
│   │   ├── client.ts         # Prisma client singleton
│   │   └── embed.ts          # Embedding generation
│   └── utils/
│       ├── rateLimiter.ts
│       ├── fuzzyMatch.ts
│       └── techExtractor.ts  # Parse tech keywords from job descriptions
├── prisma/
│   └── schema.prisma
├── scripts/
│   └── seed.ts               # One-time full data load
├── tests/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

**Deliverable:** Clean folder structure committed to Git.

---

#### Task 0.3 — Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://localhost:5432/yc_intelligence"
GITHUB_TOKEN="ghp_..."
ANTHROPIC_API_KEY="sk-ant-..."   # For future Claude enrichment
VOYAGE_API_KEY="pa-..."          # For embeddings
CRUNCHBASE_API_KEY=""            # Optional, V1.1
```

**Deliverable:** `.env.example` committed, `.env` gitignored.

---

### Phase 1 — Data Pipeline (Core)
**Estimated Time: 1–2 days**

---

#### Task 1.1 — Database Schema

Define in `prisma/schema.prisma`:

```
Models to create:
  - Company      (id, name, slug, batch, status, description, website, 
                  teamSize, isHiring, tags[], location, createdAt, updatedAt)
  - Founder      (id, name, linkedinUrl, companyId)
  - Job          (id, title, company, location, remote, description, 
                  techStack[], atsSource, url, postedAt)
  - HNPost       (id, companyId, title, url, points, comments, 
                  postType, createdAt)
  - Funding      (id, companyId, amount, round, date, source)
  - GitHubOrg    (id, companyId, orgName, stars, languages[], 
                  lastCommit, contributorCount)
  - CompanyEmbed (id, companyId, embedding Unsupported("vector(1024)"))
```

Run: `npx prisma migrate dev --name init`

**Deliverable:** Database schema migrated and running locally.

---

#### Task 1.2 — Fetch All YC Companies

File: `src/pipeline/fetchYC.ts`

```
Steps:
  1. GET https://api.ycombinator.com/v0.1/companies (paginate all pages)
  2. Normalize response to Company + Founder models
  3. Upsert into database (update if slug exists, insert if new)
  4. Log: total fetched, new records, updated records
  5. Handle rate limits with exponential backoff
```

**Acceptance criteria:** All ~4,000 companies in database after running script.

---

#### Task 1.3 — Fetch Job Postings

File: `src/pipeline/fetchJobs.ts`

```
Steps:
  1. For each company in DB, derive ATS slug from website URL
  2. Try Greenhouse endpoint → if 200, parse and store jobs
  3. Try Lever endpoint → if 200, parse and store jobs  
  4. Try Ashby endpoint → if 200, parse and store jobs
  5. For each job description, run techExtractor() to tag tech stack
  6. Upsert jobs (mark old jobs as inactive if no longer in feed)
  7. Log: companies with jobs found, total jobs stored
```

**Acceptance criteria:** Jobs stored for ≥ 40% of active YC companies.

---

#### Task 1.4 — Tech Stack Extractor

File: `src/utils/techExtractor.ts`

```
Input:  Job description string
Output: string[] of tech keywords

Logic:
  - Maintain curated keyword list (Rust, Go, Python, TypeScript, React, 
    Node, Postgres, Redis, Kubernetes, AWS, etc.)
  - Also detect framework signals ("we use Next.js", "our stack is...")
  - Return deduplicated array, normalized to lowercase
```

**Acceptance criteria:** Extracts correct tech from 10 sample job descriptions in unit tests.

---

#### Task 1.5 — Fetch Hacker News Data

File: `src/pipeline/fetchHN.ts`

```
Steps:
  1. For each company, search HN Algolia API:
     GET https://hn.algolia.com/api/v1/search?query={companyName}&tags=story
  2. Filter results to "Show HN" and "Ask HN" posts
  3. Also fetch monthly "Who Is Hiring?" threads, parse for company mentions
  4. Store as HNPost records with points and comment count
  5. Derive sentiment score: (points + comments * 2) / days_since_post
```

**Acceptance criteria:** HN posts stored for top 500 YC companies by batch recency.

---

#### Task 1.6 — Fetch GitHub Data

File: `src/pipeline/fetchGitHub.ts`

```
Steps:
  1. For each company, attempt to find GitHub org:
     - Try exact slug match: api.github.com/orgs/{slug}
     - Try website domain as org name
     - Fuzzy match against known org list
  2. If org found, fetch top 10 repos by stars
  3. Aggregate: languages[], totalStars, lastCommitDate, contributorCount
  4. Store as GitHubOrg record
```

**Acceptance criteria:** GitHub data found for ≥ 60% of YC companies.

---

#### Task 1.7 — Seed Script (Full Pipeline Run)

File: `scripts/seed.ts`

```
Runs in order:
  1. fetchYC()      → ~10 min
  2. fetchJobs()    → ~30 min
  3. fetchHN()      → ~20 min
  4. fetchGitHub()  → ~30 min
  5. generateEmbeds() → ~15 min

Total estimated: ~1.5 hours for full initial seed
```

**Deliverable:** `npm run seed` fully populates the database.

---

#### Task 1.8 — Nightly Scheduler

File: `src/pipeline/scheduler.ts`

```
Schedule:
  - 2:00 AM UTC daily   → fetchYC() + fetchJobs() + fetchHN()
  - 3:00 AM UTC weekly  → fetchGitHub() + regenerateEmbeds()

Use node-cron. Log start/end times and record counts to a refresh_log table.
```

**Deliverable:** Scheduler runs without crashing for 3+ consecutive days.

---

### Phase 2 — Vector Search
**Estimated Time: 4–6 hours**

---

#### Task 2.1 — Generate Company Embeddings

File: `src/db/embed.ts`

```
For each company:
  - Combine: name + description + tags + industry + batch
  - Call Voyage voyage-3.5 embeddings API
  - Store 1024-dimensional vector in CompanyEmbed table via pgvector
  - Batch in groups of 100 to stay within rate limits
```

**Acceptance criteria:** All companies have embeddings. Semantic query "payments infrastructure" returns Stripe-like companies.

---

#### Task 2.2 — Semantic Search Function

```
Function: semanticSearch(query: string, limit: number)

Steps:
  1. Embed the query string (same model as stored embeddings)
  2. Run pgvector cosine similarity search
  3. Return top N companies with similarity scores
  4. Filter out dead/acquired companies by default
```

**Acceptance criteria:** "AI for drug discovery" returns biotech + AI companies, not fintech.

---

### Phase 3 — MCP Tools
**Estimated Time: 1 day**

---

#### Task 3.1 — Tool: `search_companies`

```
Input params:
  - query?: string           (text search on name + description)
  - batch?: string           (e.g. "W24", "S23")
  - industry?: string        (e.g. "Climate", "Fintech", "Developer Tools")
  - status?: string          (Active / Acquired / Dead)
  - isHiring?: boolean
  - limit?: number           (default: 20, max: 100)

Output: Company[] with name, batch, description, industry, website, isHiring

Implementation: 
  - Build WHERE clause dynamically from provided params
  - Use ILIKE for text search
  - Sort by batch recency by default
```

---

#### Task 3.2 — Tool: `get_company_detail`

```
Input params:
  - name: string   (company name, fuzzy matched)

Output: Full company object including:
  - Core info (name, batch, description, website, status)
  - Founders with LinkedIn URLs
  - Current open jobs (title, location, remote, tech stack)
  - Recent HN posts (title, points, url, date)
  - Funding info (rounds, amounts, dates)
  - GitHub info (languages, stars, last activity)
```

---

#### Task 3.3 — Tool: `search_jobs`

```
Input params:
  - techStack?: string[]     (e.g. ["Rust", "PostgreSQL"])
  - title?: string           (e.g. "Senior Software Engineer")
  - remote?: boolean
  - batch?: string           (only companies from this batch)
  - industry?: string
  - limit?: number           (default: 20)

Output: Job[] with title, company, location, remote, techStack[], url, postedAt

Implementation:
  - Filter jobs by techStack using array intersection
  - Join with company table to filter by batch/industry
  - Sort by postedAt DESC
```

---

#### Task 3.4 — Tool: `search_founders`

```
Input params:
  - previousEmployer?: string  (e.g. "Google", "Stripe", "Meta")
  - school?: string            (e.g. "MIT", "Stanford")
  - name?: string

Output: Founder[] with name, linkedinUrl, company (name + batch + website)
```

---

#### Task 3.5 — Tool: `get_hn_activity`

```
Input params:
  - companyName?: string     (filter to one company)
  - postType?: string        (Show HN / Ask HN / Hiring)
  - since?: string           (ISO date string)
  - limit?: number

Output: HNPost[] sorted by points DESC
        Includes sentiment score and summary
```

---

#### Task 3.6 — Tool: `semantic_search`

```
Input params:
  - query: string            (natural language description)
  - limit?: number           (default: 10)
  - filter?: object          (optional structured filters on top of semantic)

Output: Company[] sorted by semantic similarity score
        Include similarity score in response

Example: 
  query: "infrastructure for AI model deployment at scale"
  → Returns: Modal, Replicate, BentoML, Anyscale, etc.
```

---

#### Task 3.7 — MCP Server Entry Point

File: `src/index.ts`

```typescript
// Register all tools with the MCP server
// Set server name: "yc-intelligence"
// Set server version: "1.0.0"
// Add tool descriptions that help Claude know when to use each one
// Handle errors gracefully — return structured error messages, never crash
```

---

### Phase 4 — Testing
**Estimated Time: 4–6 hours**

---

#### Task 4.1 — Unit Tests

```
Files: tests/unit/

Test coverage:
  - techExtractor: 10 job descriptions, verify correct tags
  - fuzzyMatch: company name variations → correct slug
  - semanticSearch: known queries → expected company types
  - fetchYC normalizer: raw API response → clean Company object
```

---

#### Task 4.2 — Integration Tests

```
Files: tests/integration/

Test coverage:
  - search_companies with batch filter returns correct results
  - search_jobs with techStack filter returns matching jobs
  - get_company_detail returns all sub-entities for a known company
  - semantic_search returns relevant results for 5 test queries
```

---

#### Task 4.3 — End-to-End Claude Test

```
Manually test these 10 queries through Claude with MCP active:

  1. "Which W24 YC companies are hiring Rust engineers?"
  2. "Show me climate tech companies that raised in 2024"
  3. "Find YC devtools companies with TypeScript in their stack"
  4. "What has Airbnb launched on Hacker News recently?"
  5. "Which YC founders previously worked at Stripe?"
  6. "Find companies similar to Vercel but in the AI space"
  7. "Which YC companies are fully remote and hiring backend engineers?"
  8. "What's the most upvoted YC launch on HN this year?"
  9. "Which YC healthcare companies are hiring and in the US?"
  10. "Show me YC companies founded by MIT graduates in fintech"

Pass criteria: ≥ 8 out of 10 return accurate, useful answers
```

---

### Phase 5 — Polish & Launch
**Estimated Time: 4–6 hours**

---

#### Task 5.1 — README

Must include:
- What it does (3 sentences max)
- Demo GIF or screenshot of Claude answering a real query
- Quick install guide (`git clone` → `.env` → `npm run seed` → connect to Claude)
- Full list of MCP tools with example inputs/outputs
- Data sources section
- Refresh schedule explanation

---

#### Task 5.2 — Demo GIF

```
Record Claude answering this query live:

"I'm a backend engineer with 4 years of experience in Go and 
 distributed systems. Which YC companies from the last 2 batches 
 would be the best fit for me, are actively hiring, and are in 
 developer tools or infrastructure?"

Show Claude using multiple MCP tools in sequence to answer it.
Use a screen recorder (Loom, Kap, or OBS).
```

---

#### Task 5.3 — GitHub Setup

```
Repository checklist:
  ✅ Descriptive repo name: yc-intelligence-mcp
  ✅ Topics: mcp, yc, ycombinator, claude, ai, typescript
  ✅ License: MIT
  ✅ .gitignore covers .env, node_modules, dist/
  ✅ GitHub Actions: CI runs tests on every PR
  ✅ Releases: tag v1.0.0 on launch day
```

---

#### Task 5.4 — Launch Posts

```
Post in this order (same day, 30 min apart):

1. Hacker News "Show HN: YC Company Intelligence MCP for Claude"
   - Lead with the problem, not the solution
   - Include the demo GIF link
   - Mention it's open source + MIT

2. Reddit r/ClaudeAI
   - Focus on the job search use case
   - Show example queries

3. Twitter/X thread
   - Tweet 1: The problem
   - Tweet 2: The demo GIF
   - Tweet 3: How to install
   - Tweet 4: Link to repo

4. LinkedIn post
   - Angle: "I built this to get a job at a YC startup"
   - More personal story, less technical
```

---

## 8. MCP Tools Specification

### Full Tools Reference

| Tool | Description | Key Params |
|------|-------------|------------|
| `search_companies` | Search and filter YC companies | query, batch, industry, isHiring |
| `get_company_detail` | Full profile for one company | name |
| `search_jobs` | Find jobs by tech stack or role | techStack[], title, remote, batch |
| `search_founders` | Find founders by background | previousEmployer, school |
| `get_hn_activity` | HN posts and sentiment | companyName, postType, since |
| `semantic_search` | Natural language company search | query, limit |

---

## 9. Database Schema

```sql
-- Core entity
companies (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  batch       TEXT,               -- "W24", "S23"
  status      TEXT,               -- "Active", "Acquired", "Dead"
  description TEXT,
  website     TEXT,
  team_size   TEXT,               -- "1-10", "11-50"
  is_hiring   BOOLEAN,
  tags        TEXT[],
  location    TEXT,
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP
)

founders (
  id           UUID PRIMARY KEY,
  company_id   UUID REFERENCES companies(id),
  name         TEXT NOT NULL,
  linkedin_url TEXT
)

jobs (
  id           UUID PRIMARY KEY,
  company_id   UUID REFERENCES companies(id),
  title        TEXT NOT NULL,
  location     TEXT,
  remote       BOOLEAN,
  description  TEXT,
  tech_stack   TEXT[],
  ats_source   TEXT,              -- "greenhouse", "lever", "ashby"
  url          TEXT,
  is_active    BOOLEAN DEFAULT true,
  posted_at    TIMESTAMP,
  fetched_at   TIMESTAMP
)

hn_posts (
  id           UUID PRIMARY KEY,
  company_id   UUID REFERENCES companies(id),
  title        TEXT,
  url          TEXT,
  hn_url       TEXT,
  points       INTEGER,
  comments     INTEGER,
  post_type    TEXT,              -- "Show HN", "Ask HN", "Hiring"
  posted_at    TIMESTAMP
)

funding (
  id           UUID PRIMARY KEY,
  company_id   UUID REFERENCES companies(id),
  amount       BIGINT,            -- in USD cents
  round        TEXT,              -- "Seed", "Series A"
  date         DATE,
  source       TEXT               -- "edgar", "crunchbase"
)

github_orgs (
  id                UUID PRIMARY KEY,
  company_id        UUID REFERENCES companies(id),
  org_name          TEXT,
  total_stars       INTEGER,
  languages         TEXT[],
  last_commit_date  DATE,
  contributor_count INTEGER
)

company_embeds (
  id           UUID PRIMARY KEY,
  company_id   UUID REFERENCES companies(id),
  embedding    vector(1024)        -- pgvector
)
```

---

## 10. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| YC API schema changes | Low | High | Version-pin the API, add schema validation on fetch |
| Job board rate limiting | Medium | Medium | Add delay between requests, cache for 12 hours |
| GitHub org name mismatch | High | Low | Build manual mapping table for top 100 companies |
| ATS platform not Greenhouse/Lever/Ashby | Medium | Medium | Playwright scraper as fallback for custom job pages |
| Voyage API cost for embeddings | Low | Low | One-time cost is expected to be small for ~4,000 company documents |
| Stale job data | High | Medium | Mark jobs inactive after 7 days without confirmation, refresh daily |
| LinkedIn ToS violation | High | Low | Do not scrape LinkedIn; use only data already in YC API |

---

## 11. Launch Checklist

```
Pre-Launch
  ✅ All 8 MCP tools implemented and tested
  ✅ Full seed script runs without errors
  ✅ ≥ 3,500 companies in database
  ✅ Jobs found for ≥ 40% of active companies
  ✅ 10 end-to-end Claude queries pass
  ✅ README complete with demo GIF
  ✅ .env.example has all required keys
  ✅ No secrets committed to Git

Launch Day
  ✅ Tag v1.0.0 release on GitHub
  ✅ Post to Hacker News (Show HN)
  ✅ Post to Reddit r/ClaudeAI
  ✅ Post Twitter/X thread
  ✅ Post LinkedIn story

Post-Launch
  ✅ Respond to all GitHub issues within 24 hours
  ✅ Monitor nightly refresh for failures
  ✅ Track GitHub stars and plan V1.1 based on feature requests
```

---

*Built by a software engineer, for software engineers trying to break into the YC ecosystem.*
