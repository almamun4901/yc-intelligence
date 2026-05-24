import { describe, expect, it } from 'vitest'
import type { Company, CompanySearchParams, Founder } from '../../domain'
import type { ICompanyRepository, IFounderRepository, UpsertCompanyInput } from '../../repositories'
import { CompanyService } from '../CompanyService'

describe('CompanyService', () => {
  it('searches companies with normalized filters and pagination defaults', async () => {
    const companyRepository = new InMemoryCompanyRepository()
    const service = new CompanyService(companyRepository, new InMemoryFounderRepository())

    await service.searchCompanies({
      query: '  developer tools  ',
      batch: '  W24  ',
      industry: '  devtools  ',
      isHiring: true
    })

    expect(companyRepository.lastSearchParams).toEqual({
      query: 'developer tools',
      batch: 'W24',
      industry: 'devtools',
      isHiring: true,
      limit: 20,
      offset: 0
    })
  })

  it('clamps search limits and offsets', async () => {
    const companyRepository = new InMemoryCompanyRepository()
    const service = new CompanyService(companyRepository, new InMemoryFounderRepository())

    await service.searchCompanies({ limit: 100, offset: -10 })

    expect(companyRepository.lastSearchParams).toEqual({
      limit: 50,
      offset: 0
    })
  })

  it('returns company detail with founders', async () => {
    const company = makeCompany({ id: 'company-1', slug: 'acme-ai' })
    const founders = [makeFounder({ companyId: company.id, name: 'Ada Lovelace' })]
    const service = new CompanyService(
      new InMemoryCompanyRepository([company]),
      new InMemoryFounderRepository(founders)
    )

    const detail = await service.getCompanyDetail('  acme-ai  ')

    expect(detail).toEqual({ ...company, founders })
  })

  it('returns null when company detail is missing', async () => {
    const service = new CompanyService(new InMemoryCompanyRepository(), new InMemoryFounderRepository())

    await expect(service.getCompanyDetail('missing')).resolves.toBeNull()
    await expect(service.getCompanyDetail('   ')).resolves.toBeNull()
  })
})

class InMemoryCompanyRepository implements ICompanyRepository {
  lastSearchParams: CompanySearchParams | null = null

  constructor(private readonly companies: Company[] = []) {}

  async findById(id: string): Promise<Company | null> {
    return this.companies.find((company) => company.id === id) ?? null
  }

  async findBySlug(slug: string): Promise<Company | null> {
    return this.companies.find((company) => company.slug === slug) ?? null
  }

  async search(params: CompanySearchParams): Promise<{ data: Company[]; total: number }> {
    this.lastSearchParams = params
    return { data: this.companies, total: this.companies.length }
  }

  async upsert(company: UpsertCompanyInput): Promise<Company> {
    const existing = this.companies.find((candidate) => candidate.slug === company.slug)
    if (existing) return existing

    const created = makeCompany(company)
    this.companies.push(created)
    return created
  }

  async upsertMany(companies: UpsertCompanyInput[]): Promise<number> {
    for (const company of companies) {
      await this.upsert(company)
    }
    return companies.length
  }
}

class InMemoryFounderRepository implements IFounderRepository {
  constructor(private readonly founders: Founder[] = []) {}

  async findByCompanyId(companyId: string): Promise<Founder[]> {
    return this.founders.filter((founder) => founder.companyId === companyId)
  }

  async upsertMany(founders: Parameters<IFounderRepository['upsertMany']>[0]): Promise<number> {
    for (const founder of founders) {
      this.founders.push(makeFounder(founder))
    }
    return founders.length
  }
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

function makeFounder(overrides: Partial<Founder> = {}): Founder {
  return {
    id: 'founder-1',
    companyId: 'company-1',
    name: 'Ada Lovelace',
    linkedinUrl: 'https://linkedin.com/in/ada',
    previousEmployers: [],
    schools: [],
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
    ...overrides
  }
}
