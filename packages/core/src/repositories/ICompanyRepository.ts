import type { Company, CompanySearchParams, CompanyStatus, TeamSize } from '../domain'

export interface UpsertCompanyInput {
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
  rawData?: unknown
}

export interface ICompanyRepository {
  findById(id: string): Promise<Company | null>
  findBySlug(slug: string): Promise<Company | null>
  search(params: CompanySearchParams): Promise<{ data: Company[]; total: number }>
  upsert(company: UpsertCompanyInput): Promise<Company>
  upsertMany(companies: UpsertCompanyInput[]): Promise<number>
}
