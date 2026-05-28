export type CompanyStatus = 'Active' | 'Acquired' | 'Inactive' | 'Dead'

export type TeamSize = '1-10' | '11-50' | '51-200' | '201-500' | '500+'

export interface Company {
  id: string
  name: string
  slug: string
  batch: string | null
  status: CompanyStatus
  description: string | null
  shortDescription: string | null
  website: string | null
  teamSize: TeamSize | null
  isHiring: boolean
  tags: string[]
  location: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CompanySearchParams {
  query?: string
  batch?: string
  status?: CompanyStatus
  industry?: string
  location?: string
  isHiring?: boolean
  limit?: number
  offset?: number
}
