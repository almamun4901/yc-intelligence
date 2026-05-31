import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  Company,
  CompanyDetail,
  FounderWithCompany,
  HNPost,
  Job,
  MemoryEntry
} from '@yc-intelligence/core'
import type { CompanyToolService } from '../companyTools'
import type { FounderToolService } from '../founderTools'
import type { HNToolService } from '../hnTools'
import type { JobToolService } from '../jobTools'
import type { MemoryToolService } from '../memoryTools'
import type { SemanticToolService } from '../semanticTools'
import { createYcIntelligenceMcpServer } from '../server'

describe('YC Intelligence MCP server E2E', () => {
  let client: Client
  let server: ReturnType<typeof createYcIntelligenceMcpServer>

  beforeEach(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    server = createYcIntelligenceMcpServer(
      companyService,
      jobService,
      hnService,
      semanticService,
      founderService,
      memoryService
    )
    client = new Client({ name: 'yc-intelligence-e2e', version: '1.0.0' }, { capabilities: {} })

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  })

  afterEach(async () => {
    await client.close()
    await server.close()
  })

  it('lists all registered tools through the MCP protocol', async () => {
    const { tools } = await client.listTools()
    const toolNames = tools.map((tool) => tool.name).sort()

    expect(toolNames).toEqual([
      'add_memory',
      'get_company_detail',
      'get_hn_activity',
      'search_companies',
      'search_founders',
      'search_jobs',
      'search_memory',
      'semantic_search',
      'supersede_memory'
    ])
  })

  it('calls each registered tool through the MCP client', async () => {
    await expectToolPayload('search_companies', { batch: 'W24', limit: 1 }, 'companies')
    await expectToolPayload('get_company_detail', { slug: 'acme-ai' }, 'company')
    await expectToolPayload('search_jobs', { techStack: ['Rust'], limit: 1 }, 'jobs')
    await expectToolPayload('get_hn_activity', { companySlug: 'acme-ai', limit: 1 }, 'posts')
    await expectToolPayload('semantic_search', { query: 'AI developer tools', limit: 1 }, 'companies')
    await expectToolPayload('search_founders', { previousEmployer: 'Stripe', limit: 1 }, 'founders')
    await expectToolPayload(
      'add_memory',
      {
        type: 'implementation_note',
        title: 'MCP E2E',
        body: 'E2E tests exercise MCP client calls.',
        tags: ['mcp', 'tests']
      },
      'memory'
    )
    await expectToolPayload('search_memory', { query: 'MCP', limit: 1 }, 'memories')
    await expectToolPayload(
      'supersede_memory',
      {
        oldEntryId: 'memory-1',
        type: 'decision',
        title: 'Updated MCP E2E',
        body: 'Supersession works through MCP.',
        tags: ['mcp']
      },
      'memory'
    )
  })

  it('returns a graceful not-found company response through the MCP protocol', async () => {
    const payload = await callToolJson('get_company_detail', { slug: 'missing-company' })

    expect(payload).toEqual({
      found: false,
      slug: 'missing-company',
      message: 'No YC company found for slug: missing-company'
    })
  })

  async function expectToolPayload(
    name: string,
    args: Record<string, unknown>,
    expectedKey: string
  ): Promise<void> {
    const payload = await callToolJson(name, args)
    expect(payload).toHaveProperty(expectedKey)
  }

  async function callToolJson(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = await client.callTool({ name, arguments: args })
    const content = 'content' in result && Array.isArray(result.content) ? result.content : []
    const firstContent = content[0]

    expect(firstContent?.type).toBe('text')
    return JSON.parse(firstContent?.type === 'text' ? firstContent.text : '{}') as Record<string, unknown>
  }
})

const now = new Date('2026-05-31T00:00:00.000Z')

const company: Company = {
  id: 'company-1',
  name: 'Acme AI',
  slug: 'acme-ai',
  batch: 'W24',
  status: 'Active',
  description: 'Builds AI developer tools.',
  shortDescription: 'AI developer tools',
  website: 'https://acme.example',
  teamSize: '1-10',
  isHiring: true,
  tags: ['Developer Tools', 'AI'],
  location: 'San Francisco',
  createdAt: now,
  updatedAt: now
}

const founder = {
  id: 'founder-1',
  companyId: company.id,
  name: 'Ada Lovelace',
  linkedinUrl: 'https://linkedin.com/in/ada',
  previousEmployers: ['Stripe'],
  schools: ['MIT'],
  createdAt: now
}

const hnPost: HNPost = {
  id: 'hn-1',
  companyId: company.id,
  company: {
    id: company.id,
    name: company.name,
    slug: company.slug,
    batch: company.batch,
    tags: company.tags
  },
  hnObjectId: '100',
  hnItemId: '100',
  title: 'Show HN: Acme AI',
  url: 'https://news.ycombinator.com/item?id=100',
  author: 'ada',
  points: 42,
  commentCount: 7,
  relevanceScore: 195,
  matchReasons: ['domain:acme.ai', 'launch-title:acme ai'],
  postType: 'Show HN',
  postedAt: now,
  fetchedAt: now
}

const companyDetail: CompanyDetail = {
  ...company,
  founders: [founder],
  hnPosts: [hnPost]
}

const companyService: CompanyToolService = {
  searchCompanies: async () => ({ data: [company], total: 1 }),
  getCompanyDetail: async (slug: string) => (slug === company.slug ? companyDetail : null)
}

const job: Job = {
  id: 'job-1',
  companyId: company.id,
  title: 'Rust Engineer',
  location: 'Remote',
  isRemote: true,
  description: 'Build backend systems in Rust.',
  techStack: ['Rust', 'TypeScript'],
  atsSource: 'greenhouse',
  applyUrl: 'https://acme.example/jobs/rust',
  isActive: true,
  postedAt: now,
  fetchedAt: now
}

const jobService: JobToolService = {
  searchJobs: async () => ({ data: [job], total: 1 })
}

const hnService: HNToolService = {
  searchHNActivity: async () => ({ data: [hnPost], total: 1 })
}

const semanticService: SemanticToolService = {
  semanticSearch: async () => ({ data: [{ company, score: 0.92 }], total: 1 })
}

const founderWithCompany: FounderWithCompany = {
  ...founder,
  company: {
    id: company.id,
    name: company.name,
    slug: company.slug,
    batch: company.batch,
    status: company.status,
    shortDescription: company.shortDescription,
    website: company.website,
    isHiring: company.isHiring,
    tags: company.tags,
    location: company.location
  }
}

const founderService: FounderToolService = {
  searchFounders: async () => ({ data: [founderWithCompany], total: 1 })
}

const memory: MemoryEntry = {
  id: 'memory-1',
  type: 'implementation_note',
  title: 'MCP E2E',
  body: 'E2E tests exercise MCP client calls.',
  tags: ['mcp', 'tests'],
  status: 'active',
  confidence: 1,
  sources: [],
  supersedesId: null,
  supersededById: null,
  createdAt: now,
  updatedAt: now
}

const memoryService: MemoryToolService = {
  addMemory: async () => memory,
  searchMemory: async () => ({ data: [memory], total: 1 }),
  supersedeMemory: async (oldEntryId: string) => ({
    ...memory,
    id: 'memory-2',
    title: 'Updated MCP E2E',
    supersedesId: oldEntryId
  })
}
