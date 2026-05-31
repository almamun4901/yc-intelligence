import type { AxiosInstance } from 'axios'
import { config } from '../../lib/config'
import { createHttpClient } from '../../lib/httpClient'
import { createLogger } from '../../lib/logger'
import type { Company, HNPostType } from '../../domain'
import type { ICompanyRepository, IHNPostRepository, UpsertHNPostInput } from '../../repositories'

const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1'
const HITS_PER_PAGE = 100
const DEFAULT_LOOKBACK_DAYS = 30
const CHECKPOINT_OVERLAP_DAYS = 2
const DEFAULT_MAX_PAGES_PER_COMPANY = 3
const BROAD_COMPANY_NAMES = new Set(['yc', 'y combinator', 'startup school'])
const GENERIC_SINGLE_WORD_NAMES = new Set(['arc', 'beam', 'bolt', 'clay', 'flow', 'linear', 'mercury', 'origin', 'pilot', 'scale'])
const HN_HOSTS = new Set(['news.ycombinator.com', 'ycombinator.com'])
const MIN_RELEVANCE_SCORE = 40
const MIN_STRICT_RELEVANCE_SCORE = 90
const logger = createLogger('HNFetcher')

export interface HNFetchResult {
  processed: number
  postsFound: number
  postsUpserted: number
  errors: number
}

export interface HNFetcherOptions {
  client?: AxiosInstance
  maxCompanies?: number
  lookbackDays?: number
  maxPagesPerCompany?: number
  progressInterval?: number
  now?: () => Date
}

export interface HNSearchHit {
  objectID?: string
  story_id?: number | string | null
  title?: string | null
  story_title?: string | null
  url?: string | null
  story_url?: string | null
  author?: string | null
  points?: number | null
  num_comments?: number | null
  created_at?: string | null
  created_at_i?: number | null
  story_text?: string | null
  comment_text?: string | null
}

interface HNSearchResponse {
  hits?: HNSearchHit[]
  page?: number
  nbPages?: number
}

export class HNFetcher {
  private readonly client: AxiosInstance

  constructor(
    private readonly companyRepo: ICompanyRepository,
    private readonly hnRepo: IHNPostRepository,
    private readonly options: HNFetcherOptions = {}
  ) {
    this.client = options.client ?? createHttpClient(HN_SEARCH_URL)
  }

  async run(): Promise<HNFetchResult> {
    const { data: companies } = await this.companyRepo.search({
      status: 'Active',
      limit: this.options.maxCompanies ?? 10000
    })
    const result: HNFetchResult = { processed: 0, postsFound: 0, postsUpserted: 0, errors: 0 }
    const progressInterval = this.options.progressInterval ?? 100

    logger.info({ totalCompanies: companies.length }, 'Starting HN fetch')

    for (const batch of chunk(companies, config.PIPELINE_CONCURRENCY)) {
      const settled = await Promise.allSettled(
        batch.map(async (company) => {
          const companyResult = await this.fetchForCompany(company)
          result.postsFound += companyResult.postsFound
          result.postsUpserted += companyResult.postsUpserted
          result.processed += 1
          if (progressInterval > 0 && result.processed % progressInterval === 0) {
            logger.info(result, 'HN fetch progress')
          }
        })
      )

      result.errors += settled.filter((item) => item.status === 'rejected').length
    }

    logger.info(result, 'HN fetch complete')
    return result
  }

  async fetchForCompany(company: Company): Promise<{ postsFound: number; postsUpserted: number }> {
    const syncState = await this.hnRepo.getSyncState(company.id)
    const checkpoint = calculateCheckpoint({
      lastSuccessfulSearchAt: syncState?.lastSuccessfulSearchAt ?? null,
      lookbackDays: this.options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS,
      now: this.now()
    })

    try {
      const hitsByObjectId = new Map<string, HNSearchHit>()
      for (const query of buildQueryVariants(company)) {
        const hits = await this.searchHits(query, checkpoint)
        for (const hit of hits) {
          if (hit.objectID) hitsByObjectId.set(hit.objectID, hit)
        }
      }

      const posts = [...hitsByObjectId.values()].flatMap((hit) => this.toHNPostInput(hit, company, checkpoint))
      if (posts.length > 0) {
        await this.hnRepo.upsertMany(posts)
      }

      await this.hnRepo.updateSyncState(company.id, {
        lastFetchedAt: this.now(),
        lastSuccessfulSearchAt: this.now(),
        lastSeenPostedAt: maxDate(posts.map((post) => post.postedAt)) ?? syncState?.lastSeenPostedAt ?? null,
        failureCount: 0,
        lastError: null
      })

      return { postsFound: posts.length, postsUpserted: posts.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.hnRepo.updateSyncState(company.id, {
        lastFetchedAt: this.now(),
        failureCount: (syncState?.failureCount ?? 0) + 1,
        lastError: message
      })
      logger.warn({ company: company.slug, error }, 'HN company fetch failed')
      return { postsFound: 0, postsUpserted: 0 }
    }
  }

  private async searchHits(query: string, checkpoint: Date): Promise<HNSearchHit[]> {
    const hits: HNSearchHit[] = []
    const maxPages = this.options.maxPagesPerCompany ?? DEFAULT_MAX_PAGES_PER_COMPANY

    for (let page = 0; page < maxPages; page += 1) {
      const response = await this.client.get<HNSearchResponse>('/search_by_date', {
        params: {
          query,
          tags: 'story',
          hitsPerPage: HITS_PER_PAGE,
          page,
          numericFilters: `created_at_i>=${Math.floor(checkpoint.getTime() / 1000)}`
        }
      })
      const pageHits = response.data.hits ?? []
      hits.push(...pageHits)
      if (pageHits.length < HITS_PER_PAGE || page + 1 >= (response.data.nbPages ?? 0)) break
    }

    return hits
  }

  private toHNPostInput(hit: HNSearchHit, company: Company, checkpoint: Date): UpsertHNPostInput[] {
    const title = (hit.title ?? hit.story_title)?.trim()
  const objectId = hit.objectID?.trim()
  const postedAt = parseHNDate(hit)
  if (!title || !objectId || !postedAt || postedAt < checkpoint) return []
    const relevance = scoreHNHitRelevance(hit, company)
    if (relevance.score < relevance.minimumScore) return []

    return [
      {
        companyId: company.id,
        hnObjectId: objectId,
        hnItemId: hit.story_id === undefined || hit.story_id === null ? null : String(hit.story_id),
        title,
        url: (hit.url ?? hit.story_url)?.trim() || `https://news.ycombinator.com/item?id=${objectId}`,
        author: hit.author?.trim() || null,
        points: Math.max(hit.points ?? 0, 0),
        commentCount: Math.max(hit.num_comments ?? 0, 0),
        relevanceScore: relevance.score,
        matchReasons: relevance.reasons,
        postType: classifyHNPost(title),
        postedAt,
        rawData: hit
      }
    ]
  }

  private now(): Date {
    return this.options.now?.() ?? new Date()
  }
}

export const classifyHNPost = (title: string): HNPostType => {
  const normalized = title.trim().toLowerCase()
  if (normalized.startsWith('show hn')) return 'Show HN'
  if (normalized.startsWith('ask hn')) return 'Ask HN'
  if (normalized.includes('who is hiring') || normalized.includes('is hiring')) return 'Hiring'
  if (normalized.includes('launch') || normalized.includes('introducing') || normalized.includes('announcing')) {
    return 'Launch'
  }
  return 'Other'
}

export const calculateCheckpoint = ({
  lastSuccessfulSearchAt,
  lookbackDays,
  now
}: {
  lastSuccessfulSearchAt: Date | null
  lookbackDays: number
  now: Date
}): Date => {
  const days = Math.max(lookbackDays, 1)
  const initial = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  if (!lastSuccessfulSearchAt) return initial

  const overlapped = new Date(lastSuccessfulSearchAt.getTime() - CHECKPOINT_OVERLAP_DAYS * 24 * 60 * 60 * 1000)
  return overlapped > initial ? overlapped : initial
}

const buildQueryVariants = (company: Company): string[] => {
  const variants = [company.name, company.slug, hostFromUrl(company.website)]
    .flatMap((value) => (value ? [value.trim()] : []))
    .filter((value) => value.length > 0)
  return [...new Set(variants)]
}

export interface HNHitRelevance {
  score: number
  minimumScore: number
  reasons: string[]
}

export const scoreHNHitRelevance = (hit: HNSearchHit, company: Company): HNHitRelevance => {
  const title = (hit.title ?? hit.story_title ?? '').trim()
  const titleText = title.toLowerCase()
  const storyText = `${hit.story_text ?? ''} ${hit.comment_text ?? ''}`.toLowerCase()
  const urlText = `${hit.url ?? ''} ${hit.story_url ?? ''}`.toLowerCase()
  const companyName = normalizeTerm(company.name)
  const slug = normalizeTerm(company.slug)
  const host = hostFromUrl(company.website)?.toLowerCase()
  const aliases = buildCompanyAliases(company)
  const requiresStrictEvidence = needsStrictEvidence(companyName, aliases)
  const reasons: string[] = []
  let score = 0
  let launchTitleMatched = false

  if (host && hostMatchesHitUrl(hit, host)) {
    score += 100
    reasons.push(`domain:${host}`)
  }

  for (const alias of aliases) {
    if (startsWithLaunchPrefix(titleText, alias)) {
      score += 95
      reasons.push(`launch-title:${alias}`)
      launchTitleMatched = true
      break
    }
  }

  if (!launchTitleMatched) {
    for (const alias of aliases) {
      if (containsTerm(titleText, alias)) {
        score += 80
        reasons.push(`title:${alias}`)
        break
      }
    }
  }

  if (slug.length >= 4 && containsTerm(urlText, slug)) {
    score += 45
    reasons.push(`url-slug:${slug}`)
  }

  if (!requiresStrictEvidence) {
    for (const alias of aliases) {
      if (containsTerm(storyText, alias)) {
        score += 25
        reasons.push(`story:${alias}`)
        break
      }
    }
  }

  const minimumScore = requiresStrictEvidence ? MIN_STRICT_RELEVANCE_SCORE : MIN_RELEVANCE_SCORE
  return {
    score: Math.min(score, 255),
    minimumScore,
    reasons
  }
}

const buildCompanyAliases = (company: Company): string[] => {
  const host = hostFromUrl(company.website)
  const values = [
    company.name,
    company.slug.replace(/-/g, ' '),
    host?.replace(/\.[a-z]+$/i, '').replace(/-/g, ' ')
  ]
  return [...new Set(values.map((value) => normalizeTerm(value ?? '')).filter((value) => value.length >= 3))]
}

const needsStrictEvidence = (companyName: string, aliases: string[]): boolean => {
  if (BROAD_COMPANY_NAMES.has(companyName)) return true
  return aliases.some((alias) => !alias.includes(' ') && (alias.length <= 6 || GENERIC_SINGLE_WORD_NAMES.has(alias)))
}

const startsWithLaunchPrefix = (title: string, alias: string): boolean => {
  return ['show hn', 'launch hn'].some((prefix) => {
    const normalized = title.replace(/^launch hn:/, 'launch hn').replace(/^show hn:/, 'show hn')
    return normalized.startsWith(`${prefix} ${alias}`) || normalized.startsWith(`${prefix}: ${alias}`)
  })
}

const hostMatchesHitUrl = (hit: HNSearchHit, companyHost: string): boolean => {
  const urls = [hit.url, hit.story_url].filter((url): url is string => Boolean(url))
  return urls.some((url) => {
    const hitHost = hostFromUrl(url)
    if (!hitHost || HN_HOSTS.has(hitHost)) return false
    return hitHost === companyHost || hitHost.endsWith(`.${companyHost}`)
  })
}

const containsTerm = (text: string, term: string): boolean => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text)
}

const normalizeTerm = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ')

const hostFromUrl = (value: string | null | undefined): string | null => {
  if (!value) return null
  try {
    const host = new URL(value).hostname.toLowerCase()
    return host.replace(/^www\./, '')
  } catch {
    return null
  }
}

const parseHNDate = (hit: HNSearchHit): Date | null => {
  if (hit.created_at_i) return new Date(hit.created_at_i * 1000)
  if (!hit.created_at) return null
  const date = new Date(hit.created_at)
  return Number.isNaN(date.getTime()) ? null : date
}

const maxDate = (dates: Date[]): Date | null => {
  if (dates.length === 0) return null
  return new Date(Math.max(...dates.map((date) => date.getTime())))
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
