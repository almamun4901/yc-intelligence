import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { CompanySearchParams, CompanyService } from '@yc-intelligence/core'
import { COMPANY_CACHE_TTL_SECONDS, createCacheKey, type ApiLogger, type ResponseCache } from '../cache'

export type CompanyApiService = Pick<CompanyService, 'searchCompanies' | 'getCompanyDetail'>

export interface CompanyRouteOptions {
  companyService: CompanyApiService
  cache?: ResponseCache
  logger: ApiLogger
}

type CompanySearchQuery = Omit<CompanySearchParams, 'isHiring' | 'limit' | 'offset'> & {
  isHiring?: boolean | string
  limit?: number | string
  offset?: number | string
}

interface CompanyDetailParams {
  slug: string
}

const companyStatusValues = ['Active', 'Acquired', 'Inactive', 'Dead']

export const registerCompanyRoutes = (app: FastifyInstance, options: CompanyRouteOptions) => {
  app.get(
    '/companies',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string' },
            batch: { type: 'string' },
            status: { type: 'string', enum: companyStatusValues },
            industry: { type: 'string' },
            isHiring: { type: 'boolean' },
            limit: { type: 'integer', minimum: 0 },
            offset: { type: 'integer', minimum: 0 }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: CompanySearchQuery }>, reply) => {
      const cached = await readCachedJson(request, reply, options.cache, options.logger)
      if (cached) return cached

      const result = await options.companyService.searchCompanies(toCompanySearchParams(request.query))
      const response = {
        total: result.total,
        count: result.data.length,
        companies: result.data.map((company) => ({
          name: company.name,
          slug: company.slug,
          batch: company.batch,
          status: company.status,
          shortDescription: company.shortDescription,
          website: company.website,
          teamSize: company.teamSize,
          isHiring: company.isHiring,
          tags: company.tags,
          location: company.location
        }))
      }

      await writeCachedJson(request, response, options.cache, options.logger)
      return response
    }
  )

  app.get(
    '/companies/:slug',
    {
      schema: {
        params: {
          type: 'object',
          required: ['slug'],
          additionalProperties: false,
          properties: {
            slug: { type: 'string', minLength: 1 }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: CompanyDetailParams }>, reply) => {
      const cached = await readCachedJson(request, reply, options.cache, options.logger)
      if (cached) return cached

      const detail = await options.companyService.getCompanyDetail(request.params.slug)
      if (!detail) {
        return reply.code(404).send({
          found: false,
          slug: request.params.slug,
          message: `No YC company found for slug: ${request.params.slug}`
        })
      }

      const response = {
        found: true,
        company: {
          name: detail.name,
          slug: detail.slug,
          batch: detail.batch,
          status: detail.status,
          description: detail.description,
          shortDescription: detail.shortDescription,
          website: detail.website,
          teamSize: detail.teamSize,
          isHiring: detail.isHiring,
          tags: detail.tags,
          location: detail.location,
          founders: detail.founders.map((founder) => ({
            name: founder.name,
            linkedinUrl: founder.linkedinUrl,
            previousEmployers: founder.previousEmployers,
            schools: founder.schools
          })),
          hnPosts: detail.hnPosts.map((post) => ({
            title: post.title,
            url: post.url,
            author: post.author,
            points: post.points,
            comments: post.commentCount,
            postType: post.postType,
            postedAt: post.postedAt.toISOString()
          })),
          updatedAt: detail.updatedAt.toISOString()
        }
      }

      await writeCachedJson(request, response, options.cache, options.logger)
      return response
    }
  )
}

const toCompanySearchParams = (query: CompanySearchQuery): CompanySearchParams => ({
  ...(query.query ? { query: query.query } : {}),
  ...(query.batch ? { batch: query.batch } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.industry ? { industry: query.industry } : {}),
  ...(query.isHiring !== undefined ? { isHiring: query.isHiring === true || query.isHiring === 'true' } : {}),
  ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
  ...(query.offset !== undefined ? { offset: Number(query.offset) } : {})
})

const readCachedJson = async (
  request: FastifyRequest,
  reply: FastifyReply,
  cache: ResponseCache | undefined,
  logger: ApiLogger
): Promise<unknown | null> => {
  if (!cache) return null

  try {
    const cached = await cache.get(createCacheKey(request.method, request.url))
    if (!cached) return null

    reply.header('x-cache', 'HIT')
    return JSON.parse(cached) as unknown
  } catch (err) {
    logger.warn({ err }, 'Failed to read API cache')
    return null
  }
}

const writeCachedJson = async (
  request: FastifyRequest,
  value: unknown,
  cache: ResponseCache | undefined,
  logger: ApiLogger
): Promise<void> => {
  if (!cache) return

  try {
    await cache.set(createCacheKey(request.method, request.url), JSON.stringify(value), COMPANY_CACHE_TTL_SECONDS)
  } catch (err) {
    logger.warn({ err }, 'Failed to write API cache')
  }
}
