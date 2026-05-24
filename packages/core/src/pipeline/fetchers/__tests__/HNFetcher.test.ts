import type { AxiosInstance } from 'axios'
import { describe, expect, it } from 'vitest'
import type { Company, CompanyHNSyncState, HNPost } from '../../../domain'
import type {
  ICompanyRepository,
  IHNPostRepository,
  UpdateHNSyncStateInput,
  UpsertCompanyInput,
  UpsertHNPostInput
} from '../../../repositories'
import { calculateCheckpoint, classifyHNPost, HNFetcher } from '../HNFetcher'

describe('HNFetcher', () => {
  it('classifies HN post types', () => {
    expect(classifyHNPost('Show HN: Acme AI')).toBe('Show HN')
    expect(classifyHNPost('Ask HN: Who uses Acme?')).toBe('Ask HN')
    expect(classifyHNPost('Acme is hiring engineers')).toBe('Hiring')
    expect(classifyHNPost('Introducing Acme AI')).toBe('Launch')
    expect(classifyHNPost('Acme discussion')).toBe('Other')
  })

  it('calculates an overlapped incremental checkpoint', () => {
    expect(
      calculateCheckpoint({
        lastSuccessfulSearchAt: new Date('2026-05-20T00:00:00.000Z'),
        lookbackDays: 30,
        now: new Date('2026-05-24T00:00:00.000Z')
      })
    ).toEqual(new Date('2026-05-18T00:00:00.000Z'))
  })

  it('uses search_by_date params, dedupes hits, filters false positives, and records success state', async () => {
    const company = makeCompany({
      id: 'company-1',
      name: 'Acme AI',
      slug: 'acme-ai',
      website: 'https://acme.ai'
    })
    const hnRepo = new InMemoryHNPostRepository()
    const client = makeClient([
      {
        hits: [
          {
            objectID: '100',
            story_id: 100,
            title: 'Show HN: Acme AI - agents for databases',
            url: 'https://acme.ai',
            author: 'ada',
            points: 42,
            num_comments: 7,
            created_at_i: 1778976000
          },
          {
            objectID: '100',
            story_id: 100,
            title: 'Show HN: Acme AI - agents for databases',
            url: 'https://acme.ai',
            author: 'ada',
            points: 42,
            num_comments: 7,
            created_at_i: 1778976000
          },
          {
            objectID: '101',
            story_id: 101,
            title: 'A totally different company',
            url: 'https://example.com',
            points: 100,
            num_comments: 50,
            created_at_i: 1778976000
          }
        ],
        nbPages: 1
      },
      { hits: [], nbPages: 1 },
      { hits: [], nbPages: 1 }
    ])
    const fetcher = new HNFetcher(new InMemoryCompanyRepository([company]), hnRepo, {
      client,
      now: () => new Date('2026-05-24T00:00:00.000Z'),
      lookbackDays: 30
    })

    const result = await fetcher.fetchForCompany(company)

    expect(result).toEqual({ postsFound: 1, postsUpserted: 1 })
    expect(client.calls[0]).toMatchObject({
      url: '/search_by_date',
      params: {
        query: 'Acme AI',
        tags: 'story',
        hitsPerPage: 100,
        page: 0,
        numericFilters: 'created_at_i>=1776988800'
      }
    })
    expect(hnRepo.posts).toMatchObject([
      {
        companyId: 'company-1',
        hnObjectId: '100',
        title: 'Show HN: Acme AI - agents for databases',
        points: 42,
        commentCount: 7,
        postType: 'Show HN',
        postedAt: new Date('2026-05-17T00:00:00.000Z')
      }
    ])
    expect(hnRepo.syncUpdates.at(-1)).toEqual({
      companyId: 'company-1',
      input: {
        lastFetchedAt: new Date('2026-05-24T00:00:00.000Z'),
        lastSuccessfulSearchAt: new Date('2026-05-24T00:00:00.000Z'),
        lastSeenPostedAt: new Date('2026-05-17T00:00:00.000Z'),
        failureCount: 0,
        lastError: null
      }
    })
  })

  it('records per-company failures without throwing', async () => {
    const company = makeCompany()
    const hnRepo = new InMemoryHNPostRepository()
    const fetcher = new HNFetcher(new InMemoryCompanyRepository([company]), hnRepo, {
      client: {
        get: async () => {
          throw new Error('rate limited')
        }
      } as unknown as AxiosInstance,
      now: () => new Date('2026-05-24T00:00:00.000Z')
    })

    await expect(fetcher.fetchForCompany(company)).resolves.toEqual({ postsFound: 0, postsUpserted: 0 })
    expect(hnRepo.syncUpdates.at(-1)).toEqual({
      companyId: company.id,
      input: {
        lastFetchedAt: new Date('2026-05-24T00:00:00.000Z'),
        failureCount: 1,
        lastError: 'rate limited'
      }
    })
  })
})

class InMemoryCompanyRepository implements ICompanyRepository {
  constructor(private readonly companies: Company[]) {}

  async findById(id: string): Promise<Company | null> {
    return this.companies.find((company) => company.id === id) ?? null
  }

  async findBySlug(slug: string): Promise<Company | null> {
    return this.companies.find((company) => company.slug === slug) ?? null
  }

  async search(): Promise<{ data: Company[]; total: number }> {
    return { data: this.companies, total: this.companies.length }
  }

  async upsert(company: UpsertCompanyInput): Promise<Company> {
    return makeCompany(company)
  }

  async upsertMany(): Promise<number> {
    return 0
  }
}

class InMemoryHNPostRepository implements IHNPostRepository {
  posts: UpsertHNPostInput[] = []
  syncState: CompanyHNSyncState | null = null
  syncUpdates: Array<{ companyId: string; input: UpdateHNSyncStateInput }> = []

  async upsertMany(posts: UpsertHNPostInput[]): Promise<number> {
    this.posts.push(...posts)
    return posts.length
  }

  async search(): Promise<{ data: HNPost[]; total: number }> {
    return { data: [], total: 0 }
  }

  async getSyncState(): Promise<CompanyHNSyncState | null> {
    return this.syncState
  }

  async updateSyncState(companyId: string, input: UpdateHNSyncStateInput): Promise<CompanyHNSyncState> {
    this.syncUpdates.push({ companyId, input })
    return {
      id: 'sync-1',
      companyId,
      lastFetchedAt: input.lastFetchedAt ?? null,
      lastSuccessfulSearchAt: input.lastSuccessfulSearchAt ?? null,
      lastSeenPostedAt: input.lastSeenPostedAt ?? null,
      failureCount: input.failureCount ?? 0,
      lastError: input.lastError ?? null,
      updatedAt: new Date('2026-05-24T00:00:00.000Z')
    }
  }
}

const makeClient = (responses: unknown[]) => {
  const calls: Array<{ url: string; params: Record<string, unknown> }> = []
  return {
    calls,
    get: async (url: string, options: { params: Record<string, unknown> }) => {
      calls.push({ url, params: options.params })
      return { data: responses.shift() ?? { hits: [], nbPages: 1 } }
    }
  } as AxiosInstance & { calls: Array<{ url: string; params: Record<string, unknown> }> }
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  const now = new Date('2026-05-23T00:00:00.000Z')
  return {
    id: 'company-1',
    name: 'Acme AI',
    slug: 'acme-ai',
    batch: 'W24',
    status: 'Active',
    description: 'Builds developer tools.',
    shortDescription: 'AI developer tools',
    website: 'https://example.com',
    teamSize: '1-10',
    isHiring: true,
    tags: ['Developer Tools'],
    location: 'San Francisco',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}
