import { describe, expect, it } from 'vitest'
import type { Company } from '@yc-intelligence/core'
import { z } from 'zod'
import { handleSemanticSearch, semanticSearchInputSchema } from '../semanticTools'

describe('semantic MCP tools', () => {
  it('accepts expected semantic search inputs', () => {
    const parsed = z.object(semanticSearchInputSchema).parse({
      query: 'AI developer infrastructure',
      batch: 'W24',
      status: 'Active',
      industry: 'Developer Tools',
      isHiring: true,
      limit: 10,
      offset: 5
    })

    expect(parsed).toEqual({
      query: 'AI developer infrastructure',
      batch: 'W24',
      status: 'Active',
      industry: 'Developer Tools',
      isHiring: true,
      limit: 10,
      offset: 5
    })
  })

  it('formats semantic search results as concise JSON text', async () => {
    const service = {
      semanticSearch: async () => ({ data: [{ company: makeCompany(), score: 0.87 }], total: 1 })
    }

    const result = await handleSemanticSearch({ query: 'AI developer infrastructure' }, service)
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(payload).toEqual({
      total: 1,
      count: 1,
      companies: [
        {
          name: 'Acme AI',
          slug: 'acme-ai',
          score: 0.87,
          batch: 'W24',
          status: 'Active',
          shortDescription: 'AI developer infrastructure',
          website: 'https://acme.example',
          isHiring: true,
          tags: ['Developer Tools', 'AI'],
          location: 'Remote'
        }
      ]
    })
  })
})

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
