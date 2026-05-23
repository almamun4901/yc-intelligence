import type { Founder } from '../domain'

export interface UpsertFounderInput {
  companyId: string
  name: string
  linkedinUrl: string | null
  previousEmployers?: string[]
  schools?: string[]
}

export interface IFounderRepository {
  findByCompanyId(companyId: string): Promise<Founder[]>
  upsertMany(founders: UpsertFounderInput[]): Promise<number>
}
