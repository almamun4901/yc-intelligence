import { describe, expect, it } from 'vitest'
import type { Job } from '@yc-intelligence/core'
import { z } from 'zod'
import { handleSearchJobs, searchJobsInputSchema } from '../jobTools'

describe('job MCP tools', () => {
  it('accepts expected search inputs', () => {
    const parsed = z.object(searchJobsInputSchema).parse({
      techStack: ['rust', 'postgresql'],
      title: 'backend',
      isRemote: true,
      batch: 'W24',
      industry: 'Developer Tools',
      limit: 10,
      offset: 5
    })

    expect(parsed).toEqual({
      techStack: ['rust', 'postgresql'],
      title: 'backend',
      isRemote: true,
      batch: 'W24',
      industry: 'Developer Tools',
      limit: 10,
      offset: 5
    })
  })

  it('formats job search results as concise JSON text', async () => {
    const service = {
      searchJobs: async () => ({ data: [makeJob()], total: 1 })
    }

    const result = await handleSearchJobs({ techStack: ['rust'] }, service)
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(payload).toEqual({
      total: 1,
      count: 1,
      jobs: [
        {
          title: 'Backend Engineer',
          companyId: 'company-1',
          location: 'Remote',
          isRemote: true,
          techStack: ['rust', 'postgresql'],
          applyUrl: 'https://example.com/jobs/1',
          postedAt: '2026-05-01T00:00:00.000Z'
        }
      ]
    })
  })
})

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
