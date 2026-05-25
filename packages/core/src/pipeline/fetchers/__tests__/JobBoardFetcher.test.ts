import type { AxiosInstance } from 'axios'
import { describe, expect, it } from 'vitest'
import type { Company, CompanyJobSyncState } from '../../../domain'
import type {
  ICompanyRepository,
  IJobRepository,
  UpdateJobSyncStateInput,
  UpsertCompanyInput,
  UpsertJobInput
} from '../../../repositories'
import { JobBoardFetcher } from '../JobBoardFetcher'

describe('JobBoardFetcher', () => {
  it('fetches Greenhouse jobs first and extracts tech stack', async () => {
    const company = makeCompany({ slug: 'acme' })
    const jobRepo = new InMemoryJobRepository()
    const fetcher = new JobBoardFetcher(new InMemoryCompanyRepository([company]), jobRepo, {
      client: makeClient({
        'https://boards-api.greenhouse.io/v1/boards/acme/jobs': {
          jobs: [
            {
              title: 'Backend Engineer',
              location: { name: 'Remote' },
              content: 'Build Rust services with Postgres.',
              absolute_url: 'https://boards.greenhouse.io/acme/jobs/1',
              updated_at: '2026-05-01T00:00:00.000Z'
            }
          ]
        }
      })
    })

    const result = await fetcher.run()

    expect(result).toMatchObject({
      totalCompanies: 1,
      offset: 0,
      limit: 10000,
      processed: 1,
      jobsFound: 1,
      jobsUpserted: 1,
      companiesWithJobs: 1,
      errors: 0
    })
    expect(jobRepo.jobs).toMatchObject([
      {
        companyId: company.id,
        title: 'Backend Engineer',
        location: 'Remote',
        isRemote: true,
        techStack: ['postgresql', 'rust'],
        atsSource: 'greenhouse',
        applyUrl: 'https://boards.greenhouse.io/acme/jobs/1',
        isActive: true,
        postedAt: new Date('2026-05-01T00:00:00.000Z')
      }
    ])
    expect(jobRepo.markedInactive).toEqual([{ companyId: company.id, activeJobUrls: ['https://boards.greenhouse.io/acme/jobs/1'] }])
    expect(jobRepo.syncStates.get(company.id)).toMatchObject({
      lastAtsSource: 'greenhouse',
      lastStatus: 'found_jobs',
      failureCount: 0,
      lastError: null
    })
  })

  it('falls back from Greenhouse to Lever', async () => {
    const company = makeCompany({ slug: 'leverco' })
    const fetcher = new JobBoardFetcher(new InMemoryCompanyRepository([company]), new InMemoryJobRepository(), {
      client: makeClient({
        'https://api.lever.co/v0/postings/leverco': [
          {
            text: 'Product Engineer',
            hostedUrl: 'https://jobs.lever.co/leverco/1',
            categories: { location: 'New York' },
            descriptionPlain: 'TypeScript and React',
            createdAt: 1777593600000
          }
        ]
      })
    })

    const jobs = await fetcher.fetchJobsForCompany(company)

    expect(jobs).toMatchObject([
      {
        title: 'Product Engineer',
        location: 'New York',
        techStack: ['react', 'typescript'],
        atsSource: 'lever',
        applyUrl: 'https://jobs.lever.co/leverco/1'
      }
    ])
  })

  it('falls back from Lever to Ashby', async () => {
    const company = makeCompany({ slug: 'ashbyco' })
    const fetcher = new JobBoardFetcher(new InMemoryCompanyRepository([company]), new InMemoryJobRepository(), {
      client: makeClient({
        'https://api.ashbyhq.com/posting-public/job-board/ashbyco': {
          jobs: [
            {
              title: 'Infrastructure Engineer',
              location: 'Remote - US',
              descriptionPlain: 'Kubernetes, Terraform, and AWS',
              jobUrl: 'https://jobs.ashbyhq.com/ashbyco/1',
              publishedAt: '2026-05-02T00:00:00.000Z'
            }
          ]
        }
      })
    })

    const jobs = await fetcher.fetchJobsForCompany(company)

    expect(jobs).toMatchObject([
      {
        title: 'Infrastructure Engineer',
        location: 'Remote - US',
        isRemote: true,
        techStack: ['aws', 'kubernetes', 'terraform'],
        atsSource: 'ashby',
        applyUrl: 'https://jobs.ashbyhq.com/ashbyco/1'
      }
    ])
  })

  it('uses cached ATS source first on later runs', async () => {
    const company = makeCompany({ slug: 'cachedco' })
    const jobRepo = new InMemoryJobRepository()
    await jobRepo.updateSyncState(company.id, {
      lastAtsSource: 'lever',
      lastStatus: 'found_jobs',
      failureCount: 0
    })
    const calls: string[] = []
    const fetcher = new JobBoardFetcher(new InMemoryCompanyRepository([company]), jobRepo, {
      client: makeClient(
        {
          'https://api.lever.co/v0/postings/cachedco': [
            {
              text: 'Product Engineer',
              hostedUrl: 'https://jobs.lever.co/cachedco/1',
              categories: { location: 'Remote' },
              descriptionPlain: 'TypeScript',
              createdAt: 1777593600000
            }
          ]
        },
        calls
      )
    })

    await fetcher.fetchJobsForCompany(company)

    expect(calls[0]).toBe('https://api.lever.co/v0/postings/cachedco')
  })

  it('supports offset and records no supported board outcomes', async () => {
    const companies = [makeCompany({ id: 'company-1', slug: 'first' }), makeCompany({ id: 'company-2', slug: 'second' })]
    const companyRepo = new InMemoryCompanyRepository(companies)
    const jobRepo = new InMemoryJobRepository()
    const fetcher = new JobBoardFetcher(companyRepo, jobRepo, {
      maxCompanies: 1,
      offset: 1,
      client: makeClient({})
    })

    const result = await fetcher.run()

    expect(companyRepo.lastSearchParams).toMatchObject({ status: 'Active', limit: 1, offset: 1 })
    expect(result).toMatchObject({
      totalCompanies: 2,
      offset: 1,
      limit: 1,
      processed: 1,
      companiesWithoutSupportedBoard: 1
    })
    expect(jobRepo.syncStates.get('company-2')).toMatchObject({
      lastStatus: 'no_supported_board',
      failureCount: 0
    })
  })
})

class InMemoryCompanyRepository implements ICompanyRepository {
  lastSearchParams: unknown = null

  constructor(private readonly companies: Company[]) {}

  async findById(id: string): Promise<Company | null> {
    return this.companies.find((company) => company.id === id) ?? null
  }

  async findBySlug(slug: string): Promise<Company | null> {
    return this.companies.find((company) => company.slug === slug) ?? null
  }

  async search(params: { limit?: number; offset?: number }): Promise<{ data: Company[]; total: number }> {
    this.lastSearchParams = params
    return {
      data: this.companies.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? this.companies.length)),
      total: this.companies.length
    }
  }

  async upsert(company: UpsertCompanyInput): Promise<Company> {
    return makeCompany(company)
  }

  async upsertMany(): Promise<number> {
    return 0
  }
}

class InMemoryJobRepository implements IJobRepository {
  jobs: UpsertJobInput[] = []
  markedInactive: Array<{ companyId: string; activeJobUrls: string[] }> = []
  syncStates = new Map<string, CompanyJobSyncState>()

  async findById() {
    return null
  }

  async findByCompanyId() {
    return []
  }

  async search() {
    return { data: [], total: 0 }
  }

  async upsertMany(jobs: UpsertJobInput[]): Promise<number> {
    this.jobs.push(...jobs)
    return jobs.length
  }

  async markInactiveForCompany(companyId: string, activeJobUrls: string[]): Promise<number> {
    this.markedInactive.push({ companyId, activeJobUrls })
    return 0
  }

  async getSyncState(companyId: string): Promise<CompanyJobSyncState | null> {
    return this.syncStates.get(companyId) ?? null
  }

  async updateSyncState(companyId: string, input: UpdateJobSyncStateInput): Promise<CompanyJobSyncState> {
    const existing = this.syncStates.get(companyId)
    const state: CompanyJobSyncState = {
      id: existing?.id ?? `job-sync-state-${companyId}`,
      companyId,
      lastFetchedAt: input.lastFetchedAt ?? existing?.lastFetchedAt ?? null,
      lastSuccessfulFetchAt: input.lastSuccessfulFetchAt ?? existing?.lastSuccessfulFetchAt ?? null,
      lastFoundJobsAt: input.lastFoundJobsAt ?? existing?.lastFoundJobsAt ?? null,
      lastAtsSource: input.lastAtsSource ?? existing?.lastAtsSource ?? null,
      lastStatus: input.lastStatus ?? existing?.lastStatus ?? null,
      failureCount: input.failureCount ?? existing?.failureCount ?? 0,
      lastError: input.lastError ?? existing?.lastError ?? null,
      updatedAt: new Date('2026-05-25T00:00:00.000Z')
    }
    this.syncStates.set(companyId, state)
    return state
  }
}

const makeClient = (responses: Record<string, unknown>, calls: string[] = []): AxiosInstance =>
  ({
    get: async (url: string) => {
      calls.push(url)
      const data = responses[url]
      if (!data) throw makeAxiosMiss(url)
      return { data }
    }
  }) as AxiosInstance

function makeAxiosMiss(url: string): Error {
  const error = new Error(`No mocked response for ${url}`) as Error & {
    isAxiosError: boolean
    response: { status: number }
    config: { url: string }
  }
  error.isAxiosError = true
  error.response = { status: 404 }
  error.config = { url }
  return error
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
