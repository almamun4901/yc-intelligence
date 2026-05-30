import { describe, expect, it } from 'vitest'
import type { FounderWithCompany } from '@yc-intelligence/core'
import { z } from 'zod'
import { handleSearchFounders, searchFoundersInputSchema } from '../founderTools'

describe('founder MCP tools', () => {
  it('accepts expected search inputs', () => {
    const parsed = z.object(searchFoundersInputSchema).parse({
      query: 'ada',
      company: 'acme',
      batch: 'W24',
      industry: 'Developer Tools',
      previousEmployer: 'Stripe',
      school: 'MIT',
      limit: 10,
      offset: 5
    })

    expect(parsed).toEqual({
      query: 'ada',
      company: 'acme',
      batch: 'W24',
      industry: 'Developer Tools',
      previousEmployer: 'Stripe',
      school: 'MIT',
      limit: 10,
      offset: 5
    })
  })

  it('formats founder search results as concise JSON text', async () => {
    const service = {
      searchFounders: async () => ({ data: [makeFounder()], total: 1 })
    }

    const result = await handleSearchFounders({ query: 'ada' }, service)
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(payload).toEqual({
      total: 1,
      count: 1,
      founders: [
        {
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
          }
        }
      ]
    })
  })
})

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
