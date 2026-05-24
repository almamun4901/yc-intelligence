import type { AxiosInstance } from 'axios'
import { describe, expect, it } from 'vitest'
import type { Company, JobSearchParams } from '../../../domain'
import type { ICompanyRepository, IJobRepository, UpsertCompanyInput, UpsertJobInput } from '../../../repositories'
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

    expect(result).toEqual({ processed: 1, jobsFound: 1, errors: 0 })
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

class InMemoryJobRepository implements IJobRepository {
  jobs: UpsertJobInput[] = []
  markedInactive: Array<{ companyId: string; activeJobUrls: string[] }> = []

  async findById() {
    return null
  }

  async findByCompanyId() {
    return []
  }

  async search(_params: JobSearchParams) {
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
}

const makeClient = (responses: Record<string, unknown>): AxiosInstance =>
  ({
    get: async (url: string) => {
      const data = responses[url]
      if (!data) throw new Error(`No mocked response for ${url}`)
      return { data }
    }
  }) as AxiosInstance

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
