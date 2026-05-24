import type { Company, CompanySearchParams, Founder, HNPost } from '../domain'
import type { ICompanyRepository, IFounderRepository, IHNPostRepository } from '../repositories'

const DEFAULT_SEARCH_LIMIT = 20
const MAX_SEARCH_LIMIT = 50

export interface CompanyDetail extends Company {
  founders: Founder[]
  hnPosts: HNPost[]
}

export class CompanyService {
  constructor(
    private readonly companyRepository: ICompanyRepository,
    private readonly founderRepository: IFounderRepository,
    private readonly hnPostRepository?: IHNPostRepository
  ) {}

  async searchCompanies(params: CompanySearchParams = {}): Promise<{ data: Company[]; total: number }> {
    return this.companyRepository.search(this.normalizeSearchParams(params))
  }

  async getCompanyDetail(slug: string): Promise<CompanyDetail | null> {
    const normalizedSlug = slug.trim()
    if (!normalizedSlug) return null

    const company = await this.companyRepository.findBySlug(normalizedSlug)
    if (!company) return null

    const founders = await this.founderRepository.findByCompanyId(company.id)
    const hnPosts = this.hnPostRepository
      ? (
          await this.hnPostRepository.search({
            companyId: company.id,
            limit: 5,
            sort: 'signal'
          })
        ).data
      : []
    return { ...company, founders, hnPosts }
  }

  private normalizeSearchParams(params: CompanySearchParams): CompanySearchParams {
    const normalizedQuery = params.query?.trim()
    const normalizedIndustry = params.industry?.trim()
    const normalizedBatch = params.batch?.trim()
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_SEARCH_LIMIT, 0), MAX_SEARCH_LIMIT)
    const offset = Math.max(params.offset ?? 0, 0)

    return {
      ...(normalizedQuery ? { query: normalizedQuery } : {}),
      ...(normalizedBatch ? { batch: normalizedBatch } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(normalizedIndustry ? { industry: normalizedIndustry } : {}),
      ...(params.isHiring !== undefined ? { isHiring: params.isHiring } : {}),
      limit,
      offset
    }
  }
}
