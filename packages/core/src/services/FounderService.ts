import type { FounderSearchParams, FounderWithCompany } from '../domain'
import type { IFounderRepository } from '../repositories'

const DEFAULT_SEARCH_LIMIT = 20
const MAX_SEARCH_LIMIT = 50

export class FounderService {
  constructor(private readonly founderRepository: IFounderRepository) {}

  async searchFounders(params: FounderSearchParams = {}): Promise<{ data: FounderWithCompany[]; total: number }> {
    return this.founderRepository.search(this.normalizeSearchParams(params))
  }

  private normalizeSearchParams(params: FounderSearchParams): FounderSearchParams {
    const normalizedQuery = params.query?.trim()
    const normalizedCompanyId = params.companyId?.trim()
    const normalizedCompany = params.company?.trim()
    const normalizedBatch = params.batch?.trim()
    const normalizedIndustry = params.industry?.trim()
    const normalizedPreviousEmployer = params.previousEmployer?.trim()
    const normalizedSchool = params.school?.trim()
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_SEARCH_LIMIT, 0), MAX_SEARCH_LIMIT)
    const offset = Math.max(params.offset ?? 0, 0)

    return {
      ...(normalizedQuery ? { query: normalizedQuery } : {}),
      ...(normalizedCompanyId ? { companyId: normalizedCompanyId } : {}),
      ...(normalizedCompany ? { company: normalizedCompany } : {}),
      ...(normalizedBatch ? { batch: normalizedBatch } : {}),
      ...(normalizedIndustry ? { industry: normalizedIndustry } : {}),
      ...(normalizedPreviousEmployer ? { previousEmployer: normalizedPreviousEmployer } : {}),
      ...(normalizedSchool ? { school: normalizedSchool } : {}),
      limit,
      offset
    }
  }
}
