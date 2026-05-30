export interface Founder {
  id: string
  companyId: string
  name: string
  linkedinUrl: string | null
  previousEmployers: string[]
  schools: string[]
  createdAt: Date
}

export interface FounderCompanySummary {
  id: string
  name: string
  slug: string
  batch: string | null
  status: string | null
  shortDescription: string | null
  website: string | null
  isHiring: boolean
  tags: string[]
  location: string | null
}

export interface FounderWithCompany extends Founder {
  company: FounderCompanySummary
}

export interface FounderSearchParams {
  query?: string
  companyId?: string
  company?: string
  batch?: string
  industry?: string
  previousEmployer?: string
  school?: string
  limit?: number
  offset?: number
}
