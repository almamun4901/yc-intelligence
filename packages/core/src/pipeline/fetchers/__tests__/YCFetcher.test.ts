import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import type {
  ICompanyRepository,
  IFounderRepository,
  IRefreshLogRepository,
  RefreshLogEntry,
  UpsertCompanyInput,
  UpsertFounderInput
} from '../../../repositories'
import { YCFetcher } from '../YCFetcher'

describe('YCFetcher', () => {
  it('paginates until an empty page and upserts companies before founders', async () => {
    const calls: string[] = []
    const client = axios.create({
      adapter: makeAdapter([
        { companies: [{ name: 'Alpha', slug: 'alpha', founders: [{ full_name: 'A Founder' }] }] },
        { companies: [{ name: 'Beta', slug: 'beta', founders: [{ full_name: 'B Founder' }] }] },
        { companies: [] }
      ])
    })
    const companyRepo = new MockCompanyRepository(calls)
    const founderRepo = new MockFounderRepository(calls)
    const refreshLogRepo = new MockRefreshLogRepository()

    const result = await new YCFetcher(companyRepo, founderRepo, refreshLogRepo, { client }).run()

    expect(result).toEqual({
      pagesFetched: 2,
      rawCompaniesFetched: 2,
      companiesUpserted: 2,
      foundersUpserted: 2
    })
    expect(calls).toEqual([
      'company:alpha',
      'founder:company-alpha:A Founder',
      'company:beta',
      'founder:company-beta:B Founder'
    ])
    expect(refreshLogRepo.completed).toBe(true)
  })

  it('marks refresh log as failed and rethrows API errors', async () => {
    const client = axios.create({
      adapter: async (config) => {
        throw new AxiosError('boom', undefined, config, undefined, {
          data: {},
          status: 500,
          statusText: '500',
          headers: {},
          config
        })
      }
    })
    const refreshLogRepo = new MockRefreshLogRepository()

    await expect(
      new YCFetcher(new MockCompanyRepository([]), new MockFounderRepository([]), refreshLogRepo, {
        client
      }).run()
    ).rejects.toThrow('boom')

    expect(refreshLogRepo.failed).toBe(true)
  })
})

function makeAdapter(responses: unknown[]): AxiosAdapter {
  let index = 0
  return async (config: InternalAxiosRequestConfig) => {
    const data = responses[index] ?? { companies: [] }
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
  constructor(private readonly calls: string[]) {}

  async findById() {
    return null
  }

  async findBySlug() {
    return null
  }

  async search() {
    return { data: [], total: 0 }
  }

  async upsert(company: UpsertCompanyInput) {
    this.calls.push(`company:${company.slug}`)
    return {
      ...company,
      id: `company-${company.slug}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  async upsertMany(companies: UpsertCompanyInput[]) {
    for (const company of companies) {
      await this.upsert(company)
    }
    return companies.length
  }
}

class MockFounderRepository implements IFounderRepository {
  constructor(private readonly calls: string[]) {}

  async findByCompanyId() {
    return []
  }

  async upsertMany(founders: UpsertFounderInput[]) {
    for (const founder of founders) {
      this.calls.push(`founder:${founder.companyId}:${founder.name}`)
    }
    return founders.length
  }
}

class MockRefreshLogRepository implements IRefreshLogRepository {
  completed = false
  failed = false

  async start() {
    return makeRefreshLog('running')
  }

  async complete() {
    this.completed = true
    return makeRefreshLog('success')
  }

  async fail() {
    this.failed = true
    return makeRefreshLog('failed')
  }
}

function makeRefreshLog(status: RefreshLogEntry['status']): RefreshLogEntry {
  return {
    id: 'refresh-1',
    source: 'yc',
    startedAt: new Date(),
    completedAt: status === 'running' ? null : new Date(),
    recordCount: 0,
    errorCount: status === 'failed' ? 1 : 0,
    status,
    errorMsg: status === 'failed' ? 'boom' : null
  }
}
