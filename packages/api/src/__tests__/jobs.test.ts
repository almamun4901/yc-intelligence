import { describe, expect, it } from 'vitest'
import type { Job, JobSearchParams } from '@yc-intelligence/core'
import { buildServer } from '../index'
import type { ApiLogger } from '../cache'

describe('API job routes', () => {
  it('searches jobs with supported filters', async () => {
    const service = new TestJobService()
    service.searchResult = { data: [makeJob()], total: 1 }
    const app = buildServer({ jobService: service, logger: testLogger })

    const response = await app.inject({
      method: 'GET',
      url: '/jobs?techStack=rust,postgresql&title=backend&isRemote=true&batch=W24&industry=Developer%20Tools&limit=10&offset=5'
    })

    expect(response.statusCode).toBe(200)
    expect(service.lastSearchParams).toEqual({
      techStack: ['rust', 'postgresql'],
      title: 'backend',
      isRemote: true,
      batch: 'W24',
      industry: 'Developer Tools',
      limit: 10,
      offset: 5
    })
    expect(response.json()).toEqual({
      total: 1,
      count: 1,
      jobs: [
        {
          id: 'job-1',
          companyId: 'company-1',
          title: 'Backend Engineer',
          location: 'Remote',
          isRemote: true,
          techStack: ['rust', 'postgresql'],
          atsSource: 'greenhouse',
          applyUrl: 'https://example.com/jobs/1',
          isActive: true,
          postedAt: '2026-05-01T00:00:00.000Z',
          fetchedAt: '2026-05-23T00:00:00.000Z'
        }
      ]
    })
  })

  it('returns empty job search results', async () => {
    const app = buildServer({ jobService: new TestJobService(), logger: testLogger })

    const response = await app.inject({ method: 'GET', url: '/jobs?techStack=rust' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ total: 0, count: 0, jobs: [] })
  })

  it('rejects invalid job filters', async () => {
    const app = buildServer({ jobService: new TestJobService(), logger: testLogger })

    const invalidBoolean = await app.inject({ method: 'GET', url: '/jobs?isRemote=maybe' })
    const invalidLimit = await app.inject({ method: 'GET', url: '/jobs?limit=-1' })

    expect(invalidBoolean.statusCode).toBe(400)
    expect(invalidLimit.statusCode).toBe(400)
  })
})

class TestJobService {
  searchResult: { data: Job[]; total: number } = { data: [], total: 0 }
  lastSearchParams: JobSearchParams | null = null

  async searchJobs(params: JobSearchParams): Promise<{ data: Job[]; total: number }> {
    this.lastSearchParams = params
    return this.searchResult
  }
}

const testLogger: ApiLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    companyId: 'company-1',
    title: 'Backend Engineer',
    location: 'Remote',
    isRemote: true,
    description: 'Rust and Postgres',
    techStack: ['rust', 'postgresql'],
    atsSource: 'greenhouse',
    applyUrl: 'https://example.com/jobs/1',
    isActive: true,
    postedAt: new Date('2026-05-01T00:00:00.000Z'),
    fetchedAt: new Date('2026-05-23T00:00:00.000Z'),
    ...overrides
  }
}
