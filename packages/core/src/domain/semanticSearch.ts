import type { Company, CompanySearchParams } from './company'

export interface CompanyEmbedding {
  id: string
  companyId: string
  sourceText: string
  sourceHash: string
  embeddingModel: string
  createdAt: Date
  updatedAt: Date
}

export interface SemanticCompanySearchParams extends CompanySearchParams {
  query: string
}

export interface SemanticCompanySearchMatch {
  company: Company
  score: number
}
