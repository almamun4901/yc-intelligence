import { describe, expect, it } from 'vitest'
import type {
  Company,
  CompanyEmbedding,
  CompanyJobSyncState,
  CompanySearchParams,
  HNPost,
  HNPostSearchParams,
  Job,
  CompanyHNSyncState,
  SemanticCompanySearchMatch
} from '../../domain'
import type { EmbeddingProvider } from '../../lib/embeddingProvider'
import type {
  ICompanyEmbeddingRepository,
  ICompanyRepository,
  IHNPostRepository,
  IJobRepository,
  SimilarCompanySearchParams,
  UpsertCompanyEmbeddingInput,
  UpsertCompanyInput,
  UpdateJobSyncStateInput
} from '../../repositories'
import { EmbeddingService } from '../EmbeddingService'

describe('EmbeddingService', () => {
  it('generates embeddings for changed company search documents and skips unchanged ones', async () => {
    const company = makeCompany()
    const provider = new FakeEmbeddingProvider()
    const embeddingRepository = new InMemoryCompanyEmbeddingRepository()
    const service = new EmbeddingService(
      new InMemoryCompanyRepository([company]),
      embeddingRepository,
      provider,
      new InMemoryJobRepository([makeJob()]),
      new InMemoryHNPostRepository([makeHNPost()])
    )

    await expect(service.refreshCompanyEmbeddings({ limit: 10 })).resolves.toEqual({
      processed: 1,
      generated: 1,
      skipped: 0
    })
    await expect(service.refreshCompanyEmbeddings({ limit: 10 })).resolves.toEqual({
      processed: 1,
      generated: 0,
      skipped: 1
    })

    expect(provider.inputs[0]).toContain('Name: Acme AI')
    expect(provider.inputs[0]).toContain('Backend Engineer')
    expect(embeddingRepository.upserts).toHaveLength(1)
  })

  it('normalizes semantic search params and delegates vector search', async () => {
    const company = makeCompany()
    const provider = new FakeEmbeddingProvider()
    const embeddingRepository = new InMemoryCompanyEmbeddingRepository([{ company, score: 0.91 }])
    const service = new EmbeddingService(new InMemoryCompanyRepository([company]), embeddingRepository, provider)

    const result = await service.semanticSearch({
      query: '  AI infrastructure for developers  ',
      batch: ' W24 ',
      industry: ' Developer Tools ',
      isHiring: true,
      limit: 100,
      offset: -10
    })

    expect(result.total).toBe(1)
    expect(result.data[0]?.company.slug).toBe('acme-ai')
    expect(provider.inputs).toEqual(['AI infrastructure for developers'])
    expect(embeddingRepository.lastSearchParams).toMatchObject({
      batch: 'W24',
      industry: 'Developer Tools',
      isHiring: true,
      limit: 50,
      offset: 0,
      embeddingModel: 'fake-embedding-model'
    })
  })

  it('skips missing embeddings in stale-only refresh mode', async () => {
    const provider = new FakeEmbeddingProvider()
    const service = new EmbeddingService(
      new InMemoryCompanyRepository([makeCompany()]),
      new InMemoryCompanyEmbeddingRepository(),
      provider
    )

    await expect(service.refreshCompanyEmbeddings({ staleOnly: true })).resolves.toEqual({
      processed: 1,
      generated: 0,
      skipped: 1
    })
    expect(provider.inputs).toEqual([])
  })

  it('returns an empty semantic result for blank queries', async () => {
    const provider = new FakeEmbeddingProvider()
    const embeddingRepository = new InMemoryCompanyEmbeddingRepository()
    const service = new EmbeddingService(new InMemoryCompanyRepository([makeCompany()]), embeddingRepository, provider)

    await expect(service.semanticSearch({ query: '   ' })).resolves.toEqual({ data: [], total: 0 })
    expect(provider.inputs).toEqual([])
  })
})

class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'fake-embedding-model'
  inputs: string[] = []

  async embed(text: string): Promise<number[]> {
    this.inputs.push(text)
    return [0.1, 0.2, 0.3]
  }
}

class InMemoryCompanyRepository implements ICompanyRepository {
  constructor(private readonly companies: Company[]) {}

  async findById(id: string): Promise<Company | null> {
    return this.companies.find((company) => company.id === id) ?? null
  }

  async findBySlug(slug: string): Promise<Company | null> {
    return this.companies.find((company) => company.slug === slug) ?? null
  }

  async search(params: CompanySearchParams): Promise<{ data: Company[]; total: number }> {
    const filtered = this.companies.filter((company) => !params.status || company.status === params.status)
    return {
      data: filtered.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? filtered.length)),
      total: filtered.length
    }
  }

  async upsert(company: UpsertCompanyInput): Promise<Company> {
    return makeCompany({ ...company, batch: company.batch, teamSize: company.teamSize })
  }

  async upsertMany(): Promise<number> {
    return 0
  }
}

class InMemoryCompanyEmbeddingRepository implements ICompanyEmbeddingRepository {
  upserts: UpsertCompanyEmbeddingInput[] = []
  lastSearchParams: SimilarCompanySearchParams | null = null
  private readonly embeddings = new Map<string, CompanyEmbedding>()

  constructor(private readonly matches: SemanticCompanySearchMatch[] = []) {}

  async findByCompanyId(companyId: string): Promise<CompanyEmbedding | null> {
    return this.embeddings.get(companyId) ?? null
  }

  async upsert(input: UpsertCompanyEmbeddingInput): Promise<CompanyEmbedding> {
    this.upserts.push(input)
    const embedding = {
      id: `embedding-${input.companyId}`,
      companyId: input.companyId,
      sourceText: input.sourceText,
      sourceHash: input.sourceHash,
      embeddingModel: input.embeddingModel,
      createdAt: new Date('2026-05-24T00:00:00.000Z'),
      updatedAt: new Date('2026-05-24T00:00:00.000Z')
    }
    this.embeddings.set(input.companyId, embedding)
    return embedding
  }

  async searchSimilar(params: SimilarCompanySearchParams): Promise<{ data: SemanticCompanySearchMatch[]; total: number }> {
    this.lastSearchParams = params
    return { data: this.matches, total: this.matches.length }
  }
}

class InMemoryJobRepository implements IJobRepository {
  constructor(private readonly jobs: Job[]) {}

  async findById(): Promise<Job | null> {
    return null
  }

  async findByCompanyId(companyId: string): Promise<Job[]> {
    return this.jobs.filter((job) => job.companyId === companyId)
  }

  async search(): Promise<{ data: Job[]; total: number }> {
    return { data: this.jobs, total: this.jobs.length }
  }

  async upsertMany(): Promise<number> {
    return 0
  }

  async markInactiveForCompany(): Promise<number> {
    return 0
  }

  async getSyncState(): Promise<CompanyJobSyncState | null> {
    return null
  }

  async updateSyncState(companyId: string, input: UpdateJobSyncStateInput): Promise<CompanyJobSyncState> {
    return {
      id: 'job-sync-state-1',
      companyId,
      lastFetchedAt: input.lastFetchedAt ?? null,
      lastSuccessfulFetchAt: input.lastSuccessfulFetchAt ?? null,
      lastFoundJobsAt: input.lastFoundJobsAt ?? null,
      lastAtsSource: input.lastAtsSource ?? null,
      lastStatus: input.lastStatus ?? null,
      failureCount: input.failureCount ?? 0,
      lastError: input.lastError ?? null,
      updatedAt: new Date('2026-05-25T00:00:00.000Z')
    }
  }
}

class InMemoryHNPostRepository implements IHNPostRepository {
  constructor(private readonly posts: HNPost[]) {}

  async upsertMany(): Promise<number> {
    return 0
  }

  async search(params: HNPostSearchParams): Promise<{ data: HNPost[]; total: number }> {
    const data = this.posts.filter((post) => !params.companyId || post.companyId === params.companyId)
    return { data, total: data.length }
  }

  async getSyncState() {
    return null
  }

  async updateSyncState(): Promise<CompanyHNSyncState> {
    throw new Error('Not implemented')
  }
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    name: 'Acme AI',
    slug: 'acme-ai',
    batch: 'W24',
    status: 'Active',
    description: 'Builds AI infrastructure for developers.',
    shortDescription: 'AI developer infrastructure',
    website: 'https://acme.example',
    teamSize: '1-10',
    isHiring: true,
    tags: ['Developer Tools', 'AI'],
    location: 'Remote',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides
  }
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    companyId: 'company-1',
    title: 'Backend Engineer',
    location: 'Remote',
    isRemote: true,
    description: 'Rust and Postgres',
    techStack: ['rust', 'postgresql'],
    atsSource: 'greenhouse',
    applyUrl: 'https://example.com/jobs/1',
    isActive: true,
    postedAt: new Date('2026-05-01T00:00:00.000Z'),
    fetchedAt: new Date('2026-05-23T00:00:00.000Z'),
    ...overrides
  }
}

function makeHNPost(overrides: Partial<HNPost> = {}): HNPost {
  return {
    id: 'hn-1',
    companyId: 'company-1',
    hnObjectId: '123',
    hnItemId: '123',
    title: 'Show HN: Acme AI',
    url: 'https://news.ycombinator.com/item?id=123',
    author: 'founder',
    points: 10,
    commentCount: 2,
    postType: 'Show HN',
    postedAt: new Date('2026-05-01T00:00:00.000Z'),
    fetchedAt: new Date('2026-05-23T00:00:00.000Z'),
    rawData: null,
    ...overrides
  }
}
