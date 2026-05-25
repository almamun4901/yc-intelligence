import { describe, expect, it } from 'vitest'
import type { CompanyJobSyncState, Job, JobSearchParams } from '../../domain'
import type { IJobRepository, UpdateJobSyncStateInput } from '../../repositories'
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

  async upsertMany(): Promise<number> {
    return 0
  }

  async markInactiveForCompany(): Promise<number> {
    return 0
  }

  async getSyncState(): Promise<CompanyJobSyncState | null> {
    return null
  }

  async updateSyncState(companyId: string, input: UpdateJobSyncStateInput): Promise<CompanyJobSyncState> {
    return makeJobSyncState({ companyId, ...input })
  }
}

function makeJobSyncState(overrides: Partial<CompanyJobSyncState> = {}): CompanyJobSyncState {
  return {
    id: 'job-sync-state-1',
    companyId: 'company-1',
    lastFetchedAt: null,
    lastSuccessfulFetchAt: null,
    lastFoundJobsAt: null,
    lastAtsSource: null,
    lastStatus: null,
    failureCount: 0,
    lastError: null,
    updatedAt: new Date('2026-05-25T00:00:00.000Z'),
    ...overrides
  }
}
