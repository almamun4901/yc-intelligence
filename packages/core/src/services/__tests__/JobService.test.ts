import { describe, expect, it } from 'vitest'
import type { Job, JobSearchParams } from '../../domain'
import type { IJobRepository, UpsertJobInput } from '../../repositories'
import { JobService } from '../JobService'

describe('JobService', () => {
  it('searches jobs with normalized filters and defaults', async () => {
    const jobRepository = new InMemoryJobRepository()
    const service = new JobService(jobRepository)

    await service.searchJobs({
      techStack: [' TypeScript ', 'REACT', ''],
      title: '  backend engineer  ',
      batch: ' W24 ',
      industry: ' Developer Tools ',
      isRemote: true
    })

    expect(jobRepository.lastSearchParams).toEqual({
      techStack: ['typescript', 'react'],
      title: 'backend engineer',
      batch: 'W24',
      industry: 'Developer Tools',
      isRemote: true,
      isActive: true,
      limit: 20,
      offset: 0
    })
  })

  it('preserves explicit inactive searches and clamps pagination', async () => {
    const jobRepository = new InMemoryJobRepository()
    const service = new JobService(jobRepository)

    await service.searchJobs({ isActive: false, limit: 100, offset: -10 })

    expect(jobRepository.lastSearchParams).toEqual({
      isActive: false,
      limit: 50,
      offset: 0
    })
  })
})

class InMemoryJobRepository implements IJobRepository {
  lastSearchParams: JobSearchParams | null = null

  async findById(): Promise<Job | null> {
    return null
  }

  async findByCompanyId(): Promise<Job[]> {
    return []
  }

  async search(params: JobSearchParams): Promise<{ data: Job[]; total: number }> {
    this.lastSearchParams = params
    return { data: [], total: 0 }
  }

  async upsertMany(_jobs: UpsertJobInput[]): Promise<number> {
    return 0
  }

  async markInactiveForCompany(): Promise<number> {
    return 0
  }
}
