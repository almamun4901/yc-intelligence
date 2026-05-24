import { describe, expect, it } from 'vitest'
import type { Company, CompanyDetail } from '@yc-intelligence/core'
import { handleGetCompanyDetail, handleSearchCompanies, searchCompaniesInputSchema } from '../companyTools'
import { z } from 'zod'

describe('company MCP tools', () => {
  it('accepts expected search inputs', () => {
    const parsed = z.object(searchCompaniesInputSchema).parse({
      query: 'ai',
      batch: 'W24',
      status: 'Active',
      industry: 'Developer Tools',
      isHiring: true,
      limit: 10,
      offset: 5
    })

    expect(parsed).toEqual({
      query: 'ai',
      batch: 'W24',
      status: 'Active',
      industry: 'Developer Tools',
      isHiring: true,
      limit: 10,
      offset: 5
    })
  })

  it('formats company search results as concise JSON text', async () => {
    const company = makeCompany()
    const service = {
      searchCompanies: async () => ({ data: [company], total: 1 }),
      getCompanyDetail: async () => null
    }

    const result = await handleSearchCompanies({ query: 'acme' }, service)
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(payload).toMatchObject({
      total: 1,
      count: 1,
      companies: [
        {
          name: 'Acme AI',
          slug: 'acme-ai',
          isHiring: true
        }
      ]
    })
    expect(payload.companies[0].description).toBeUndefined()
  })

  it('formats a clear not-found detail response', async () => {
    const service = {
      searchCompanies: async () => ({ data: [], total: 0 }),
      getCompanyDetail: async () => null
    }

    const result = await handleGetCompanyDetail({ slug: 'missing' }, service)
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(payload).toEqual({
      found: false,
      slug: 'missing',
      message: 'No YC company found for slug: missing'
    })
  })

  it('formats company detail with founders when available', async () => {
    const detail: CompanyDetail = {
      ...makeCompany(),
      founders: [
        {
          id: 'founder-1',
          companyId: 'company-1',
          name: 'Ada Lovelace',
          linkedinUrl: 'https://linkedin.com/in/ada',
          previousEmployers: ['Analytical Engines Inc'],
          schools: [],
          createdAt: new Date('2026-05-23T00:00:00.000Z')
        }
      ]
    }
    const service = {
      searchCompanies: async () => ({ data: [], total: 0 }),
      getCompanyDetail: async () => detail
    }

    const result = await handleGetCompanyDetail({ slug: 'acme-ai' }, service)
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(payload.found).toBe(true)
    expect(payload.company.slug).toBe('acme-ai')
    expect(payload.company.founders).toEqual([
      {
        name: 'Ada Lovelace',
        linkedinUrl: 'https://linkedin.com/in/ada',
        previousEmployers: ['Analytical Engines Inc'],
        schools: []
      }
    ])
  })
})

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
