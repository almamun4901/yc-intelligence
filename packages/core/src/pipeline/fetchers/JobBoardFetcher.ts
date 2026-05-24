import axios, { type AxiosInstance } from 'axios'
import { config } from '../../lib/config'
import { createHttpClient } from '../../lib/httpClient'
import { createLogger } from '../../lib/logger'
import { extractTechStack } from '../../lib/techExtractor'
import type { Company, Job } from '../../domain'
import type { ICompanyRepository, IJobRepository, UpsertJobInput } from '../../repositories'

const logger = createLogger('JobBoardFetcher')

export interface JobBoardFetchResult {
  processed: number
  jobsFound: number
  errors: number
}

interface JobBoardFetcherOptions {
  client?: AxiosInstance
  maxCompanies?: number
  progressInterval?: number
}

type JobInput = Omit<Job, 'id' | 'fetchedAt'>

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
    const { data: companies } = await this.companyRepo.search({
      status: 'Active',
      limit: this.options.maxCompanies ?? 10000
    })
    const result: JobBoardFetchResult = { processed: 0, jobsFound: 0, errors: 0 }
    const progressInterval = this.options.progressInterval ?? 100

    logger.info({ totalCompanies: companies.length }, 'Starting job board fetch')

    for (const batch of chunk(companies, config.PIPELINE_CONCURRENCY)) {
      const settled = await Promise.allSettled(
        batch.map(async (company) => {
          const jobs = await this.fetchJobsForCompany(company)
          if (jobs.length > 0) {
            await this.jobRepo.upsertMany(jobs)
            await this.jobRepo.markInactiveForCompany(
              company.id,
              jobs.map((job) => job.applyUrl)
            )
            result.jobsFound += jobs.length
          }
          result.processed += 1
          if (progressInterval > 0 && result.processed % progressInterval === 0) {
            logger.info(result, 'Job board fetch progress')
          }
        })
      )

      result.errors += settled.filter((item) => item.status === 'rejected').length
    }

    logger.info(result, 'Job board fetch complete')
    return result
  }

  async fetchJobsForCompany(company: Company): Promise<UpsertJobInput[]> {
    const slug = this.deriveSlug(company)

    for (const fetcher of [this.fetchGreenhouse, this.fetchLever, this.fetchAshby]) {
      try {
        const jobs = await fetcher.call(this, slug, company.id)
        if (jobs.length > 0) return jobs
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        const url = axios.isAxiosError(error) ? error.config?.url : undefined
        const logPayload = { company: company.slug, status, url }
        if (status === 401 || status === 404) {
          logger.debug(logPayload, 'ATS board unavailable; trying next source')
        } else {
          logger.warn({ ...logPayload, error }, 'ATS fetch failed; trying next source')
        }
      }
    }

    return []
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

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
