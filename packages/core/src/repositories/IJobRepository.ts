import type { ATSSource, Job, JobSearchParams } from '../domain'

export interface UpsertJobInput {
  companyId: string
  title: string
  location: string | null
  isRemote: boolean
  description: string | null
  techStack: string[]
  atsSource: ATSSource
  applyUrl: string
  isActive: boolean
  postedAt: Date | null
}

export interface IJobRepository {
  findById(id: string): Promise<Job | null>
  findByCompanyId(companyId: string): Promise<Job[]>
  search(params: JobSearchParams): Promise<{ data: Job[]; total: number }>
  upsertMany(jobs: UpsertJobInput[]): Promise<number>
  markInactiveForCompany(companyId: string, activeJobUrls: string[]): Promise<number>
}
