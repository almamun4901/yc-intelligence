import { describe, expect, it } from 'vitest'
import type { Company, SemanticCompanySearchMatch, SemanticCompanySearchParams } from '@yc-intelligence/core'
import { buildServer } from '../index'
import type { ApiLogger } from '../cache'

describe('API semantic search routes', () => {
  it('searches companies by semantic query with supported filters', async () => {
    const service = new TestSemanticSearchService()
    service.searchResult = { data: [{ company: makeCompany(), score: 0.87 }], total: 1 }
    const app = buildServer({ semanticSearchService: service, logger: testLogger })

    const response = await app.inject({
      method: 'GET',
      url: '/search/semantic?query=AI%20developer%20infrastructure&batch=W24&status=Active&industry=Developer%20Tools&location=Dhaka&isHiring=true&limit=10&offset=5'
    })

    expect(response.statusCode).toBe(200)
    expect(service.lastSearchParams).toEqual({
      query: 'AI developer infrastructure',
      batch: 'W24',
      status: 'Active',
      industry: 'Developer Tools',
      location: 'Dhaka',
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
          score: 0.87,
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

  it('returns empty semantic search results', async () => {
    const app = buildServer({ semanticSearchService: new TestSemanticSearchService(), logger: testLogger })

    const response = await app.inject({
      method: 'GET',
      url: '/search/semantic?query=workflow%20automation'
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ total: 0, count: 0, companies: [] })
  })

  it('rejects invalid semantic search filters', async () => {
    const app = buildServer({ semanticSearchService: new TestSemanticSearchService(), logger: testLogger })

    const missingQuery = await app.inject({ method: 'GET', url: '/search/semantic' })
    const invalidStatus = await app.inject({ method: 'GET', url: '/search/semantic?query=dev&status=Paused' })
    const invalidBoolean = await app.inject({ method: 'GET', url: '/search/semantic?query=dev&isHiring=maybe' })
    const invalidLimit = await app.inject({ method: 'GET', url: '/search/semantic?query=dev&limit=-1' })

    expect(missingQuery.statusCode).toBe(400)
    expect(invalidStatus.statusCode).toBe(400)
    expect(invalidBoolean.statusCode).toBe(400)
    expect(invalidLimit.statusCode).toBe(400)
  })
})

class TestSemanticSearchService {
  searchResult: { data: SemanticCompanySearchMatch[]; total: number } = { data: [], total: 0 }
  lastSearchParams: SemanticCompanySearchParams | null = null

  async semanticSearch(
    params: SemanticCompanySearchParams
  ): Promise<{ data: SemanticCompanySearchMatch[]; total: number }> {
    this.lastSearchParams = params
    return this.searchResult
  }
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
