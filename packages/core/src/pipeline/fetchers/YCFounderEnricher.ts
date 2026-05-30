import type { AxiosInstance } from 'axios'
import { config } from '../../lib/config'
import { createHttpClient } from '../../lib/httpClient'
import { createLogger } from '../../lib/logger'
import type { Company } from '../../domain'
import type { ICompanyRepository, IFounderRepository, UpsertFounderInput } from '../../repositories'

const YC_PUBLIC_URL = 'https://www.ycombinator.com'
const DEFAULT_PAGE_SIZE = 100
const logger = createLogger('YCFounderEnricher')

export interface YCFounderEnricherOptions {
  maxCompanies?: number
  offset?: number
  pageSize?: number
  client?: AxiosInstance
}

export interface YCFounderEnrichmentResult {
  totalCompanies: number
  offset: number
  limit: number
  processed: number
  pagesFetched: number
  foundersFound: number
  foundersUpserted: number
  companiesWithFounders: number
  companiesWithoutFounders: number
  errors: number
}

interface ParsedFounder {
  name: string
  linkedinUrl: string | null
}

export class YCFounderEnricher {
  private readonly client: AxiosInstance
  private readonly maxCompanies: number | undefined
  private readonly offset: number
  private readonly pageSize: number

  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly founderRepo: IFounderRepository,
    options: YCFounderEnricherOptions = {}
  ) {
    this.client = options.client ?? createHttpClient(YC_PUBLIC_URL)
    this.maxCompanies = options.maxCompanies
    this.offset = options.offset ?? 0
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  }

  async run(): Promise<YCFounderEnrichmentResult> {
    const result: YCFounderEnrichmentResult = {
      totalCompanies: 0,
      offset: this.offset,
      limit: this.maxCompanies ?? 0,
      processed: 0,
      pagesFetched: 0,
      foundersFound: 0,
      foundersUpserted: 0,
      companiesWithFounders: 0,
      companiesWithoutFounders: 0,
      errors: 0
    }

    const firstPage = await this.companyRepo.search({ limit: 0, offset: 0 })
    result.totalCompanies = firstPage.total
    result.limit = this.maxCompanies ?? Math.max(result.totalCompanies - this.offset, 0)

    let nextOffset = this.offset
    while (result.processed < result.limit) {
      const remaining = result.limit - result.processed
      const page = await this.companyRepo.search({
        limit: Math.min(this.pageSize, remaining),
        offset: nextOffset
      })
      if (page.data.length === 0) break

      for (const batch of chunk(page.data, config.PIPELINE_CONCURRENCY)) {
        await Promise.all(batch.map((company) => this.enrichCompany(company, result)))
      }

      result.processed += page.data.length
      result.pagesFetched += 1
      nextOffset += page.data.length
      logger.info(
        { processed: result.processed, totalCompanies: result.totalCompanies, foundersUpserted: result.foundersUpserted },
        'YC founder enrichment progress'
      )
    }

    logger.info(result, 'YC founder enrichment complete')
    return result
  }

  private async enrichCompany(company: Company, result: YCFounderEnrichmentResult): Promise<void> {
    try {
      const response = await this.client.get<string>(`/companies/${company.slug}`)
      const founders = parseYCCompanyPageFounders(response.data).map((founder) => ({
        companyId: company.id,
        name: founder.name,
        linkedinUrl: founder.linkedinUrl,
        previousEmployers: [],
        schools: []
      }))

      result.foundersFound += founders.length
      if (founders.length === 0) {
        result.companiesWithoutFounders += 1
        return
      }

      result.foundersUpserted += await this.upsertFounders(founders)
      result.companiesWithFounders += 1
    } catch (error) {
      result.errors += 1
      logger.warn(
        { slug: company.slug, error: error instanceof Error ? error.message : String(error) },
        'Failed to enrich YC founders for company'
      )
    }
  }

  private async upsertFounders(founders: UpsertFounderInput[]): Promise<number> {
    if (founders.length === 0) return 0
    return this.founderRepo.upsertMany(founders)
  }
}

export function parseYCCompanyPageFounders(html: string): ParsedFounder[] {
  const match = html.match(/data-page="([^"]+)"/)
  if (!match?.[1]) return []

  const dataPage = JSON.parse(decodeHtmlAttribute(match[1])) as unknown
  if (!isRecord(dataPage)) return []
  const props = dataPage.props
  if (!isRecord(props)) return []
  const company = props.company
  if (!isRecord(company) || !Array.isArray(company.founders)) return []

  const byName = new Map<string, ParsedFounder>()
  for (const rawFounder of company.founders) {
    if (!isRecord(rawFounder)) continue
    const name = normalizeString(rawFounder.full_name) ?? normalizeString(rawFounder.name)
    if (!name) continue

    byName.set(name, {
      name,
      linkedinUrl: normalizeString(rawFounder.linkedin_url) ?? normalizeString(rawFounder.linkedinUrl) ?? null
    })
  }

  return Array.from(byName.values())
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
