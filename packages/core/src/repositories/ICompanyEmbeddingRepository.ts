import type { CompanyEmbedding, SemanticCompanySearchMatch, SemanticCompanySearchParams } from '../domain'

export interface UpsertCompanyEmbeddingInput {
  companyId: string
  sourceText: string
  sourceHash: string
  embeddingModel: string
  embedding: number[]
}

export interface SimilarCompanySearchParams extends Omit<SemanticCompanySearchParams, 'query'> {
  embedding: number[]
  embeddingModel: string
}

export interface ICompanyEmbeddingRepository {
  findByCompanyId(companyId: string): Promise<CompanyEmbedding | null>
  upsert(input: UpsertCompanyEmbeddingInput): Promise<CompanyEmbedding>
  searchSimilar(params: SimilarCompanySearchParams): Promise<{ data: SemanticCompanySearchMatch[]; total: number }>
}
