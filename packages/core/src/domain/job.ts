export type ATSSource = 'greenhouse' | 'lever' | 'ashby'

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
