import type {
  Company,
  CompanySearchParams,
  HNPost,
  Job,
  SemanticCompanySearchMatch,
  SemanticCompanySearchParams
} from '../domain'
import type { EmbeddingProvider } from '../lib/embeddingProvider'
import { buildCompanySearchDocument, hashCompanySearchDocument } from '../lib/companySearchDocument'
import type {
  ICompanyEmbeddingRepository,
  ICompanyRepository,
  IHNPostRepository,
  IJobRepository
} from '../repositories'

const DEFAULT_REFRESH_LIMIT = 100
const DEFAULT_SEARCH_LIMIT = 10
const MAX_SEARCH_LIMIT = 50

export interface EmbeddingRefreshOptions {
  limit?: number
  offset?: number
  status?: CompanySearchParams['status']
  staleOnly?: boolean
}

export interface EmbeddingRefreshResult {
  processed: number
  generated: number
  skipped: number
}

export class EmbeddingService {
  constructor(
    private readonly companyRepository: ICompanyRepository,
    private readonly embeddingRepository: ICompanyEmbeddingRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly jobRepository?: IJobRepository,
    private readonly hnPostRepository?: IHNPostRepository
  ) {}

  async refreshCompanyEmbeddings(options: EmbeddingRefreshOptions = {}): Promise<EmbeddingRefreshResult> {
    const companies = await this.companyRepository.search({
      ...(options.status ? { status: options.status } : {}),
      limit: Math.max(options.limit ?? DEFAULT_REFRESH_LIMIT, 0),
      offset: Math.max(options.offset ?? 0, 0)
    })
    const result: EmbeddingRefreshResult = { processed: 0, generated: 0, skipped: 0 }

    for (const company of companies.data) {
      result.processed += 1
      const sourceText = await this.buildSourceText(company)
      const sourceHash = hashCompanySearchDocument(sourceText)
      const existing = await this.embeddingRepository.findByCompanyId(company.id)

      if (existing?.sourceHash === sourceHash && existing.embeddingModel === this.embeddingProvider.model) {
        result.skipped += 1
        continue
      }

      if (options.staleOnly === true && !existing) {
        result.skipped += 1
        continue
      }

      const embedding = await this.embeddingProvider.embed(sourceText)
      await this.embeddingRepository.upsert({
        companyId: company.id,
        sourceText,
        sourceHash,
        embeddingModel: this.embeddingProvider.model,
        embedding
      })
      result.generated += 1
    }

    return result
  }

  async semanticSearch(
    params: SemanticCompanySearchParams
  ): Promise<{ data: SemanticCompanySearchMatch[]; total: number }> {
    const normalized = this.normalizeSearchParams(params)
    if (!normalized.query) return { data: [], total: 0 }

    const embedding = await this.embeddingProvider.embed(normalized.query)
    return this.embeddingRepository.searchSimilar({
      ...normalized,
      embedding,
      embeddingModel: this.embeddingProvider.model
    })
  }

  private async buildSourceText(company: Company): Promise<string> {
    const [jobs, hnPosts] = await Promise.all([this.getJobs(company.id), this.getHNPosts(company.id)])
    return buildCompanySearchDocument({ company, jobs, hnPosts })
  }

  private async getJobs(companyId: string): Promise<Job[]> {
    return this.jobRepository?.findByCompanyId(companyId) ?? []
  }

  private async getHNPosts(companyId: string): Promise<HNPost[]> {
    return (
      (
        await this.hnPostRepository?.search({
          companyId,
          sort: 'newest',
          limit: 5
        })
      )?.data ?? []
    )
  }

  private normalizeSearchParams(params: SemanticCompanySearchParams): SemanticCompanySearchParams {
    const query = params.query.trim()
    const batch = params.batch?.trim()
    const industry = params.industry?.trim()
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_SEARCH_LIMIT, 0), MAX_SEARCH_LIMIT)
    const offset = Math.max(params.offset ?? 0, 0)

    return {
      query,
      ...(batch ? { batch } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(industry ? { industry } : {}),
      ...(params.isHiring !== undefined ? { isHiring: params.isHiring } : {}),
      limit,
      offset
    }
  }
}
