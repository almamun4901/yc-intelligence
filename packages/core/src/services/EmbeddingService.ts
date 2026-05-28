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
const DEFAULT_REFRESH_BATCH_SIZE = 16
const DEFAULT_SEARCH_LIMIT = 10
const MAX_SEARCH_LIMIT = 50

export interface EmbeddingRefreshOptions {
  limit?: number
  offset?: number
  status?: CompanySearchParams['status']
  staleOnly?: boolean
  batchSize?: number
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

    const pending: Array<{ company: Company; sourceText: string; sourceHash: string }> = []

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

      pending.push({ company, sourceText, sourceHash })
    }

    const batchSize = Math.max(options.batchSize ?? DEFAULT_REFRESH_BATCH_SIZE, 1)
    for (let start = 0; start < pending.length; start += batchSize) {
      const batch = pending.slice(start, start + batchSize)
      const embeddings = await this.embedMany(batch.map((item) => item.sourceText))

      for (const [index, item] of batch.entries()) {
        const embedding = embeddings[index]
        if (!embedding) throw new Error(`Embedding provider returned no vector for company ${item.company.id}`)

        await this.embeddingRepository.upsert({
          companyId: item.company.id,
          sourceText: item.sourceText,
          sourceHash: item.sourceHash,
          embeddingModel: this.embeddingProvider.model,
          embedding
        })
        result.generated += 1
      }
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

  private async embedMany(texts: string[]): Promise<number[][]> {
    return this.embeddingProvider.embedMany
      ? this.embeddingProvider.embedMany(texts)
      : Promise.all(texts.map((text) => this.embeddingProvider.embed(text)))
  }

  private normalizeSearchParams(params: SemanticCompanySearchParams): SemanticCompanySearchParams {
    const query = params.query.trim()
    const batch = params.batch?.trim()
    const industry = params.industry?.trim()
    const location = params.location?.trim()
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_SEARCH_LIMIT, 0), MAX_SEARCH_LIMIT)
    const offset = Math.max(params.offset ?? 0, 0)

    return {
      query,
      ...(batch ? { batch } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(industry ? { industry } : {}),
      ...(location ? { location } : {}),
      ...(params.isHiring !== undefined ? { isHiring: params.isHiring } : {}),
      limit,
      offset
    }
  }
}
