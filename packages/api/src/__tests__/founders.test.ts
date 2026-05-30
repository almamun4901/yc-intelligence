import { describe, expect, it } from 'vitest'
import type { FounderSearchParams, FounderWithCompany } from '@yc-intelligence/core'
import { buildServer } from '../index'
import type { ApiLogger } from '../cache'

describe('API founder routes', () => {
  it('searches founders with supported filters', async () => {
    const service = new TestFounderService()
    service.searchResult = { data: [makeFounder()], total: 1 }
    const app = buildServer({ founderService: service, logger: testLogger })

    const response = await app.inject({
      method: 'GET',
      url: '/founders?query=ada&company=acme&batch=W24&industry=Developer%20Tools&previousEmployer=Stripe&school=MIT&limit=10&offset=5'
    })

    expect(response.statusCode).toBe(200)
    expect(service.lastSearchParams).toEqual({
      query: 'ada',
      company: 'acme',
      batch: 'W24',
      industry: 'Developer Tools',
      previousEmployer: 'Stripe',
      school: 'MIT',
      limit: 10,
      offset: 5
    })
    expect(response.json()).toEqual({
      total: 1,
      count: 1,
      founders: [
        {
          id: 'founder-1',
          companyId: 'company-1',
          name: 'Ada Lovelace',
          linkedinUrl: 'https://linkedin.com/in/ada',
          previousEmployers: ['Stripe'],
          schools: ['MIT'],
          company: {
            name: 'Acme',
            slug: 'acme',
            batch: 'W24',
            status: 'Active',
            shortDescription: 'Developer tools for teams',
            website: 'https://example.com',
            isHiring: true,
            tags: ['Developer Tools'],
            location: 'San Francisco'
          },
          createdAt: '2026-05-23T00:00:00.000Z'
        }
      ]
    })
  })

  it('rejects invalid founder filters', async () => {
    const app = buildServer({ founderService: new TestFounderService(), logger: testLogger })

    const invalidLimit = await app.inject({ method: 'GET', url: '/founders?limit=-1' })

    expect(invalidLimit.statusCode).toBe(400)
  })
})

class TestFounderService {
  searchResult: { data: FounderWithCompany[]; total: number } = { data: [], total: 0 }
  lastSearchParams: FounderSearchParams | null = null

  async searchFounders(params: FounderSearchParams): Promise<{ data: FounderWithCompany[]; total: number }> {
    this.lastSearchParams = params
    return this.searchResult
  }
}

const testLogger: ApiLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
}

function makeFounder(overrides: Partial<FounderWithCompany> = {}): FounderWithCompany {
  return {
    id: 'founder-1',
    companyId: 'company-1',
    name: 'Ada Lovelace',
    linkedinUrl: 'https://linkedin.com/in/ada',
    previousEmployers: ['Stripe'],
    schools: ['MIT'],
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
    company: {
      id: 'company-1',
      name: 'Acme',
      slug: 'acme',
      batch: 'W24',
      status: 'Active',
      shortDescription: 'Developer tools for teams',
      website: 'https://example.com',
      isHiring: true,
      tags: ['Developer Tools'],
      location: 'San Francisco'
    },
    ...overrides
  }
}
