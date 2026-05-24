import { describe, expect, it } from 'vitest'
import type { Company, CompanySearchParams, Founder } from '@yc-intelligence/core'
import { buildServer } from '../index'
import type { ApiLogger, ResponseCache } from '../cache'

describe('API company routes', () => {
  it('returns health status', async () => {
    const app = buildServer({ logger: testLogger })

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })

  it('searches companies with supported filters', async () => {
    const service = new TestCompanyService()
    service.searchResult = { data: [makeCompany()], total: 1 }
    const app = buildServer({ companyService: service, logger: testLogger })

    const response = await app.inject({
      method: 'GET',
      url: '/companies?query=dev&batch=W24&status=Active&industry=Developer%20Tools&isHiring=true&limit=10&offset=5'
    })

    expect(response.statusCode).toBe(200)
    expect(service.lastSearchParams).toEqual({
      query: 'dev',
      batch: 'W24',
      status: 'Active',
      industry: 'Developer Tools',
      isHiring: true,
      limit: 10,
      offset: 5
    })
    expect(response.json()).toEqual({
      total: 1,
      count: 1,
      companies: [
        {
          name: 'Acme AI',
          slug: 'acme-ai',
          batch: 'W24',
          status: 'Active',
          shortDescription: 'AI developer tools',
          website: 'https://example.com',
          teamSize: '1-10',
          isHiring: true,
          tags: ['Developer Tools'],
          location: 'San Francisco'
        }
      ]
    })
  })

  it('rejects invalid company search filters', async () => {
    const app = buildServer({ companyService: new TestCompanyService(), logger: testLogger })

    const invalidStatus = await app.inject({ method: 'GET', url: '/companies?status=Paused' })
    const invalidOffset = await app.inject({ method: 'GET', url: '/companies?offset=-1' })
    const invalidBoolean = await app.inject({ method: 'GET', url: '/companies?isHiring=maybe' })

    expect(invalidStatus.statusCode).toBe(400)
    expect(invalidOffset.statusCode).toBe(400)
    expect(invalidBoolean.statusCode).toBe(400)
  })

  it('returns company detail with founders', async () => {
    const service = new TestCompanyService()
    service.detailResult = {
      ...makeCompany(),
      founders: [makeFounder()]
    }
    const app = buildServer({ companyService: service, logger: testLogger })

    const response = await app.inject({ method: 'GET', url: '/companies/acme-ai' })

    expect(response.statusCode).toBe(200)
    expect(service.lastDetailSlug).toBe('acme-ai')
    expect(response.json()).toEqual({
      found: true,
      company: {
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
        founders: [
          {
            name: 'Ada Lovelace',
            linkedinUrl: 'https://linkedin.com/in/ada',
            previousEmployers: [],
            schools: []
          }
        ],
        updatedAt: '2026-05-23T00:00:00.000Z'
      }
    })
  })

  it('returns 404 for missing company detail', async () => {
    const app = buildServer({ companyService: new TestCompanyService(), logger: testLogger })

    const response = await app.inject({ method: 'GET', url: '/companies/missing' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      found: false,
      slug: 'missing',
      message: 'No YC company found for slug: missing'
    })
  })

  it('caches successful company GET responses', async () => {
    const service = new TestCompanyService()
    service.searchResult = { data: [makeCompany()], total: 1 }
    const cache = new MemoryResponseCache()
    const app = buildServer({ companyService: service, cache, logger: testLogger })

    const first = await app.inject({ method: 'GET', url: '/companies?batch=W24&query=dev' })
    const second = await app.inject({ method: 'GET', url: '/companies?query=dev&batch=W24' })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(second.headers['x-cache']).toBe('HIT')
    expect(service.searchCalls).toBe(1)
    expect(second.json()).toEqual(first.json())
  })

  it('continues uncached when cache operations fail', async () => {
    const service = new TestCompanyService()
    service.searchResult = { data: [makeCompany()], total: 1 }
    const app = buildServer({
      companyService: service,
      cache: new FailingResponseCache(),
      logger: testLogger
    })

    const response = await app.inject({ method: 'GET', url: '/companies?query=dev' })

    expect(response.statusCode).toBe(200)
    expect(service.searchCalls).toBe(1)
  })
})

class TestCompanyService {
  searchResult: { data: Company[]; total: number } = { data: [], total: 0 }
  detailResult: (Company & { founders: Founder[] }) | null = null
  lastSearchParams: CompanySearchParams | null = null
  lastDetailSlug: string | null = null
  searchCalls = 0

  async searchCompanies(params: CompanySearchParams): Promise<{ data: Company[]; total: number }> {
    this.searchCalls += 1
    this.lastSearchParams = params
    return this.searchResult
  }

  async getCompanyDetail(slug: string): Promise<(Company & { founders: Founder[] }) | null> {
    this.lastDetailSlug = slug
    return this.detailResult
  }
}

class MemoryResponseCache implements ResponseCache {
  private readonly values = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value)
  }

  async close(): Promise<void> {}
}

class FailingResponseCache implements ResponseCache {
  async get(): Promise<string | null> {
    throw new Error('cache get failed')
  }

  async set(): Promise<void> {
    throw new Error('cache set failed')
  }

  async close(): Promise<void> {}
}

const testLogger: ApiLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
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
