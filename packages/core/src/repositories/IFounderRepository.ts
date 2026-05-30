import type { Founder, FounderSearchParams, FounderWithCompany } from '../domain'

export interface UpsertFounderInput {
  companyId: string
  name: string
  linkedinUrl: string | null
  previousEmployers?: string[]
  schools?: string[]
}

export interface IFounderRepository {
  findByCompanyId(companyId: string): Promise<Founder[]>
  search(params: FounderSearchParams): Promise<{ data: FounderWithCompany[]; total: number }>
  upsertMany(founders: UpsertFounderInput[]): Promise<number>
}
