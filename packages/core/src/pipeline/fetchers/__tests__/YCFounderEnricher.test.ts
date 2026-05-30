import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import type { Company } from '../../../domain'
import type { ICompanyRepository, IFounderRepository, UpsertFounderInput } from '../../../repositories'
import { parseYCCompanyPageFounders, YCFounderEnricher } from '../YCFounderEnricher'

describe('parseYCCompanyPageFounders', () => {
  it('extracts founders from YC public page data', () => {
    const payload = {
      props: {
        company: {
          founders: [
            {
              full_name: 'Ada Lovelace',
              linkedin_url: 'https://linkedin.com/in/ada'
            },
            {
              full_name: 'Grace Hopper',
              linkedin_url: ''
            }
          ]
        }
      }
    }
    const html = `<div data-page="${escapeHtmlAttribute(JSON.stringify(payload))}"></div>`

    expect(parseYCCompanyPageFounders(html)).toEqual([
      { name: 'Ada Lovelace', linkedinUrl: 'https://linkedin.com/in/ada' },
      { name: 'Grace Hopper', linkedinUrl: null }
    ])
  })
})

describe('YCFounderEnricher', () => {
  it('fetches company pages and upserts parsed founders', async () => {
    const companyRepo = new MockCompanyRepository([makeCompany({ id: 'company-1', slug: 'acme' })])
    const founderRepo = new MockFounderRepository()
    const client = axios.create({
      adapter: makeAdapter([
        `<div data-page="${escapeHtmlAttribute(
          JSON.stringify({
            props: {
              company: {
                founders: [{ full_name: 'Ada Lovelace', linkedin_url: 'https://linkedin.com/in/ada' }]
              }
            }
          })
        )}"></div>`
      ])
    })

    const result = await new YCFounderEnricher(companyRepo, founderRepo, { client, pageSize: 1 }).run()

    expect(result).toMatchObject({
      totalCompanies: 1,
      processed: 1,
      pagesFetched: 1,
      foundersFound: 1,
      foundersUpserted: 1,
      companiesWithFounders: 1,
      companiesWithoutFounders: 0,
      errors: 0
    })
    expect(founderRepo.founders).toEqual([
      {
        companyId: 'company-1',
        name: 'Ada Lovelace',
        linkedinUrl: 'https://linkedin.com/in/ada',
        previousEmployers: [],
        schools: []
      }
    ])
  })
})

function makeAdapter(responses: string[]): AxiosAdapter {
  let index = 0
  return async (config: InternalAxiosRequestConfig) => {
    const data = responses[index] ?? ''
    index += 1
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }
  }
}

class MockCompanyRepository implements ICompanyRepository {
  constructor(private readonly companies: Company[]) {}

  async findById() {
    return null
  }

  async findBySlug() {
    return null
  }

  async search(params: { limit?: number; offset?: number }) {
    return {
      data: this.companies.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 20)),
      total: this.companies.length
    }
  }

  async upsert() {
    return this.companies[0]
  }

  async upsertMany() {
    return 0
  }
}

class MockFounderRepository implements IFounderRepository {
  founders: UpsertFounderInput[] = []

  async findByCompanyId() {
    return []
  }

  async search() {
    return { data: [], total: 0 }
  }

  async upsertMany(founders: UpsertFounderInput[]) {
    this.founders.push(...founders)
    return founders.length
  }
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    name: 'Acme',
    slug: 'acme',
    batch: 'W24',
    status: 'Active',
    description: null,
    shortDescription: 'A company',
    website: 'https://example.com',
    teamSize: '1-10',
    isHiring: false,
    tags: [],
    location: null,
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
    updatedAt: new Date('2026-05-23T00:00:00.000Z'),
    ...overrides
  }
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}
