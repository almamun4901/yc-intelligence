import type { Job, JobSearchParams } from '../domain'
import type { IJobRepository } from '../repositories'

const DEFAULT_SEARCH_LIMIT = 20
const MAX_SEARCH_LIMIT = 50

export class JobService {
  constructor(private readonly jobRepository: IJobRepository) {}

  async searchJobs(params: JobSearchParams = {}): Promise<{ data: Job[]; total: number }> {
    return this.jobRepository.search(this.normalizeSearchParams(params))
  }

  private normalizeSearchParams(params: JobSearchParams): JobSearchParams {
    const normalizedTitle = params.title?.trim()
    const normalizedCompanyId = params.companyId?.trim()
    const normalizedBatch = params.batch?.trim()
    const normalizedIndustry = params.industry?.trim()
    const techStack = params.techStack
      ?.map((tech) => tech.trim().toLowerCase())
      .filter((tech) => tech.length > 0)
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_SEARCH_LIMIT, 0), MAX_SEARCH_LIMIT)
    const offset = Math.max(params.offset ?? 0, 0)

    return {
      ...(techStack && techStack.length > 0 ? { techStack } : {}),
      ...(normalizedTitle ? { title: normalizedTitle } : {}),
      ...(normalizedCompanyId ? { companyId: normalizedCompanyId } : {}),
      ...(params.isRemote !== undefined ? { isRemote: params.isRemote } : {}),
      ...(normalizedBatch ? { batch: normalizedBatch } : {}),
      ...(normalizedIndustry ? { industry: normalizedIndustry } : {}),
      isActive: params.isActive ?? true,
      limit,
      offset
    }
  }
}
