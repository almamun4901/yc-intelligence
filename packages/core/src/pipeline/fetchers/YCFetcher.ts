import type { AxiosInstance } from 'axios'
import { createHttpClient } from '../../lib/httpClient'
import { createLogger } from '../../lib/logger'
import type {
  ICompanyRepository,
  IFounderRepository,
  IRefreshLogRepository,
  UpsertFounderInput
} from '../../repositories'
import { YCTransformer, type RawYCCompany } from '../transformers'

const YC_API_URL = 'https://api.ycombinator.com/v0.1'
const PAGE_SIZE = 100
const logger = createLogger('YCFetcher')

export interface YCFetchResult {
  pagesFetched: number
  rawCompaniesFetched: number
  companiesUpserted: number
  foundersUpserted: number
}

interface YCCompaniesResponse {
  companies?: RawYCCompany[]
}

export class YCFetcher {
  private readonly client: AxiosInstance
  private readonly transformer: YCTransformer

  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly founderRepo: IFounderRepository,
    private readonly refreshLogRepo: IRefreshLogRepository,
    options: { client?: AxiosInstance; transformer?: YCTransformer } = {}
  ) {
    this.client = options.client ?? createHttpClient(YC_API_URL)
    this.transformer = options.transformer ?? new YCTransformer()
  }

  async run(): Promise<YCFetchResult> {
    const refreshLog = await this.refreshLogRepo.start('yc')
    const result: YCFetchResult = {
      pagesFetched: 0,
      rawCompaniesFetched: 0,
      companiesUpserted: 0,
      foundersUpserted: 0
    }

    try {
      const fetched = await this.fetchAllPages()
      const rawCompanies = fetched.companies
      result.rawCompaniesFetched = rawCompanies.length
      result.pagesFetched = fetched.pagesFetched

      for (const rawCompany of rawCompanies) {
        const companyInput = this.transformer.toCompany(rawCompany)
        const savedCompany = await this.companyRepo.upsert(companyInput)
        result.companiesUpserted += 1

        const founders = this.transformer.toFounders(rawCompany, savedCompany.id)
        result.foundersUpserted += await this.upsertFounders(founders)
      }

      await this.refreshLogRepo.complete(refreshLog.id, {
        recordCount: result.companiesUpserted + result.foundersUpserted
      })
      logger.info(result, 'YC fetch complete')
      return result
    } catch (error) {
      await this.refreshLogRepo.fail(refreshLog.id, {
        recordCount: result.companiesUpserted + result.foundersUpserted,
        errorCount: 1,
        errorMsg: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  private async fetchAllPages(): Promise<{ companies: RawYCCompany[]; pagesFetched: number }> {
    const companies: RawYCCompany[] = []
    let page = 1
    let pagesFetched = 0

    while (true) {
      const response = await this.client.get<YCCompaniesResponse | RawYCCompany[]>('/companies', {
        params: { page, limit: PAGE_SIZE }
      })
      const pageCompanies = this.extractCompanies(response.data)
      if (pageCompanies.length === 0) break

      pagesFetched += 1
      companies.push(...pageCompanies)
      logger.info({ page, fetched: pageCompanies.length, total: companies.length }, 'YC page fetched')
      page += 1
    }

    return { companies, pagesFetched }
  }

  private extractCompanies(data: YCCompaniesResponse | RawYCCompany[]): RawYCCompany[] {
    if (Array.isArray(data)) return data
    return Array.isArray(data.companies) ? data.companies : []
  }

  private async upsertFounders(founders: UpsertFounderInput[]) {
    if (founders.length === 0) return 0
    return this.founderRepo.upsertMany(founders)
  }
}
