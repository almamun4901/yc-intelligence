import type { HNPostSearchParams } from '../domain'
import type { IHNPostRepository } from '../repositories'

const DEFAULT_SEARCH_LIMIT = 20
const MAX_SEARCH_LIMIT = 50

export class HNService {
  constructor(private readonly hnPostRepository: IHNPostRepository) {}

  async searchHNActivity(params: HNPostSearchParams = {}) {
    return this.hnPostRepository.search(this.normalizeSearchParams(params))
  }

  private normalizeSearchParams(params: HNPostSearchParams): HNPostSearchParams {
    const companyId = params.companyId?.trim()
    const companySlug = params.companySlug?.trim()
    const companyName = params.companyName?.trim()
    const batch = params.batch?.trim()
    const industry = params.industry?.trim()
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_SEARCH_LIMIT, 0), MAX_SEARCH_LIMIT)
    const offset = Math.max(params.offset ?? 0, 0)
    const minPoints = params.minPoints !== undefined ? Math.max(params.minPoints, 0) : undefined

    return {
      ...(companyId ? { companyId } : {}),
      ...(companySlug ? { companySlug } : {}),
      ...(companyName ? { companyName } : {}),
      ...(batch ? { batch } : {}),
      ...(industry ? { industry } : {}),
      ...(params.postType ? { postType: params.postType } : {}),
      ...(params.since ? { since: params.since } : {}),
      ...(params.until ? { until: params.until } : {}),
      ...(minPoints !== undefined ? { minPoints } : {}),
      sort: params.sort ?? (params.since ? 'newest' : 'signal'),
      limit,
      offset
    }
  }
}
