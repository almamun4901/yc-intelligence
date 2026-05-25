export type ATSSource = 'greenhouse' | 'lever' | 'ashby'
export type JobSyncStatus =
  | 'found_jobs'
  | 'zero_jobs'
  | 'no_supported_board'
  | 'transient_failure'
  | 'parser_failure'

export interface Job {
  id: string
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
  fetchedAt: Date
}

export interface JobSearchParams {
  techStack?: string[]
  title?: string
  companyId?: string
  isRemote?: boolean
  batch?: string
  industry?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

export interface CompanyJobSyncState {
  id: string
  companyId: string
  lastFetchedAt: Date | null
  lastSuccessfulFetchAt: Date | null
  lastFoundJobsAt: Date | null
  lastAtsSource: ATSSource | null
  lastStatus: JobSyncStatus | null
  failureCount: number
  lastError: string | null
  updatedAt: Date
}
