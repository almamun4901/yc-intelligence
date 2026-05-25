import axios, { type AxiosInstance } from 'axios'
import { config } from '../../lib/config'
import { createHttpClient } from '../../lib/httpClient'
import { createLogger } from '../../lib/logger'
import { extractTechStack } from '../../lib/techExtractor'
import type { ATSSource, Company, Job, JobSyncStatus } from '../../domain'
import type { ICompanyRepository, IJobRepository, UpsertJobInput } from '../../repositories'

const logger = createLogger('JobBoardFetcher')
const ATS_SOURCES = ['greenhouse', 'lever', 'ashby'] as const

export interface JobBoardFetchResult {
  totalCompanies: number
  offset: number
  limit: number
  processed: number
  jobsFound: number
  jobsUpserted: number
  companiesWithJobs: number
  companiesWithZeroJobs: number
  companiesWithoutSupportedBoard: number
  transientFailures: number
  parserFailures: number
  inactiveMarked: number
  errors: number
}

export interface JobBoardFetcherOptions {
  client?: AxiosInstance
  maxCompanies?: number
  offset?: number
  progressInterval?: number
  now?: () => Date
}

type JobInput = Omit<Job, 'id' | 'fetchedAt'>
type FetchOutcomeStatus = Extract<JobSyncStatus, 'found_jobs' | 'zero_jobs' | 'no_supported_board' | 'transient_failure'>

interface CompanyJobFetchOutcome {
  jobs: UpsertJobInput[]
  status: FetchOutcomeStatus
  atsSource: ATSSource | null
  error: string | null
}

interface GreenhouseResponse {
  jobs?: Array<{
    title?: string
    location?: { name?: string | null } | null
    content?: string | null
    absolute_url?: string
    updated_at?: string | null
  }>
}

interface LeverJob {
  text?: string
  hostedUrl?: string
  applyUrl?: string
  categories?: {
    location?: string | null
  }
  descriptionPlain?: string | null
  description?: string | null
  createdAt?: number | null
}

interface AshbyResponse {
  jobs?: Array<{
    title?: string
    location?: string | null
    descriptionPlain?: string | null
    descriptionHtml?: string | null
    jobUrl?: string
    publishedAt?: string | null
  }>
}

export class JobBoardFetcher {
  private readonly client: AxiosInstance

  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly jobRepo: IJobRepository,
    private readonly options: JobBoardFetcherOptions = {}
  ) {
    this.client = options.client ?? createHttpClient(undefined, { delayMs: 300 })
  }

  async run(): Promise<JobBoardFetchResult> {
    const offset = Math.max(this.options.offset ?? 0, 0)
    const limit = this.options.maxCompanies ?? 10000
    const { data: companies, total } = await this.companyRepo.search({
      status: 'Active',
      limit,
      offset
    })
    const result: JobBoardFetchResult = {
      totalCompanies: total,
      offset,
      limit,
      processed: 0,
      jobsFound: 0,
      jobsUpserted: 0,
      companiesWithJobs: 0,
      companiesWithZeroJobs: 0,
      companiesWithoutSupportedBoard: 0,
      transientFailures: 0,
      parserFailures: 0,
      inactiveMarked: 0,
      errors: 0
    }
    const progressInterval = this.options.progressInterval ?? 100

    logger.info({ totalCompanies: total, selectedCompanies: companies.length, offset, limit }, 'Starting job board fetch')

    for (const batch of chunk(companies, config.PIPELINE_CONCURRENCY)) {
      const settled = await Promise.allSettled(
        batch.map(async (company) => {
          const outcome = await this.fetchJobsForCompanyWithOutcome(company)
          if (outcome.jobs.length > 0) {
            result.jobsUpserted += await this.jobRepo.upsertMany(outcome.jobs)
          }

          if (outcome.status === 'found_jobs' || outcome.status === 'zero_jobs') {
            result.inactiveMarked += await this.jobRepo.markInactiveForCompany(
              company.id,
              outcome.jobs.map((job) => job.applyUrl)
            )
          }

          await this.recordSyncState(company, outcome)

          result.jobsFound += outcome.jobs.length
          if (outcome.status === 'found_jobs') result.companiesWithJobs += 1
          if (outcome.status === 'zero_jobs') result.companiesWithZeroJobs += 1
          if (outcome.status === 'no_supported_board') result.companiesWithoutSupportedBoard += 1
          if (outcome.status === 'transient_failure') result.transientFailures += 1
          result.processed += 1

          if (progressInterval > 0 && result.processed % progressInterval === 0) {
            logger.info(
              {
                ...result,
                selectedCompanies: companies.length,
                remainingInSelection: companies.length - result.processed,
                currentCompany: company.slug
              },
              'Job board fetch progress'
            )
          }
        })
      )

      result.errors += settled.filter((item) => item.status === 'rejected').length
    }

    result.errors += result.transientFailures + result.parserFailures
    logger.info(result, 'Job board fetch complete')
    return result
  }

  async fetchJobsForCompany(company: Company): Promise<UpsertJobInput[]> {
    return (await this.fetchJobsForCompanyWithOutcome(company)).jobs
  }

  private async fetchJobsForCompanyWithOutcome(company: Company): Promise<CompanyJobFetchOutcome> {
    const syncState = await this.jobRepo.getSyncState(company.id)
    const slug = this.deriveSlug(company)
    let sawTransientFailure = false
    let lastError: string | null = null

    for (const source of orderSources(syncState?.lastAtsSource ?? null)) {
      try {
        const jobs = await this.fetchSource(source, slug, company.id)
        return {
          jobs,
          status: jobs.length > 0 ? 'found_jobs' : 'zero_jobs',
          atsSource: source,
          error: null
        }
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        const url = axios.isAxiosError(error) ? error.config?.url : undefined
        const logPayload = { company: company.slug, source, status, url }
        if (status === 401 || status === 404) {
          logger.debug(logPayload, 'ATS board unavailable; trying next source')
        } else {
          sawTransientFailure = true
          lastError = error instanceof Error ? error.message : String(error)
          logger.warn({ ...logPayload, error }, 'ATS fetch failed; trying next source')
        }
      }
    }

    return {
      jobs: [],
      status: sawTransientFailure ? 'transient_failure' : 'no_supported_board',
      atsSource: null,
      error: lastError
    }
  }

  private async recordSyncState(company: Company, outcome: CompanyJobFetchOutcome): Promise<void> {
    const existing = await this.jobRepo.getSyncState(company.id)
    const now = this.now()
    const success = outcome.status === 'found_jobs' || outcome.status === 'zero_jobs' || outcome.status === 'no_supported_board'

    await this.jobRepo.updateSyncState(company.id, {
      lastFetchedAt: now,
      ...(success ? { lastSuccessfulFetchAt: now } : {}),
      ...(outcome.status === 'found_jobs' ? { lastFoundJobsAt: now } : {}),
      lastAtsSource: outcome.atsSource ?? existing?.lastAtsSource ?? null,
      lastStatus: outcome.status,
      failureCount: success ? 0 : (existing?.failureCount ?? 0) + 1,
      lastError: success ? null : outcome.error
    })
  }

  private async fetchSource(source: ATSSource, slug: string, companyId: string): Promise<JobInput[]> {
    if (source === 'greenhouse') return this.fetchGreenhouse(slug, companyId)
    if (source === 'lever') return this.fetchLever(slug, companyId)
    return this.fetchAshby(slug, companyId)
  }

  private now(): Date {
    return this.options.now?.() ?? new Date()
  }

  private async fetchGreenhouse(slug: string, companyId: string): Promise<JobInput[]> {
    const response = await this.client.get<GreenhouseResponse>(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
    )

    return (response.data.jobs ?? []).flatMap((job) => {
      const title = job.title?.trim()
      const applyUrl = job.absolute_url?.trim()
      if (!title || !applyUrl) return []

      const description = job.content ?? null
      const location = job.location?.name ?? null
      return [
        {
          companyId,
          title,
          location,
          isRemote: isRemoteLocation(location),
          description,
          techStack: extractTechStack(description ?? ''),
          atsSource: 'greenhouse',
          applyUrl,
          isActive: true,
          postedAt: parseDate(job.updated_at)
        }
      ]
    })
  }

  private async fetchLever(slug: string, companyId: string): Promise<JobInput[]> {
    const response = await this.client.get<LeverJob[]>(`https://api.lever.co/v0/postings/${slug}`, {
      params: { mode: 'json' }
    })

    return response.data.flatMap((job) => {
      const title = job.text?.trim()
      const applyUrl = (job.hostedUrl ?? job.applyUrl)?.trim()
      if (!title || !applyUrl) return []

      const description = job.descriptionPlain ?? job.description ?? null
      const location = job.categories?.location ?? null
      return [
        {
          companyId,
          title,
          location,
          isRemote: isRemoteLocation(location),
          description,
          techStack: extractTechStack(description ?? ''),
          atsSource: 'lever',
          applyUrl,
          isActive: true,
          postedAt: job.createdAt ? new Date(job.createdAt) : null
        }
      ]
    })
  }

  private async fetchAshby(slug: string, companyId: string): Promise<JobInput[]> {
    const response = await this.client.get<AshbyResponse>(`https://api.ashbyhq.com/posting-public/job-board/${slug}`)

    return (response.data.jobs ?? []).flatMap((job) => {
      const title = job.title?.trim()
      const applyUrl = job.jobUrl?.trim()
      if (!title || !applyUrl) return []

      const description = job.descriptionPlain ?? job.descriptionHtml ?? null
      const location = job.location ?? null
      return [
        {
          companyId,
          title,
          location,
          isRemote: isRemoteLocation(location),
          description,
          techStack: extractTechStack(description ?? ''),
          atsSource: 'ashby',
          applyUrl,
          isActive: true,
          postedAt: parseDate(job.publishedAt)
        }
      ]
    })
  }

  private deriveSlug(company: Company): string {
    return company.slug || company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
}

const isRemoteLocation = (location: string | null): boolean => location?.toLowerCase().includes('remote') ?? false

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const orderSources = (preferred: ATSSource | null): ATSSource[] => {
  if (!preferred) return [...ATS_SOURCES]
  return [preferred, ...ATS_SOURCES.filter((source) => source !== preferred)]
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
