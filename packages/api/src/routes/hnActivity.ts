import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { HNPostSearchParams, HNPostType, HNService } from '@yc-intelligence/core'

export type HNActivityApiService = Pick<HNService, 'searchHNActivity'>

export interface HNActivityRouteOptions {
  hnService: HNActivityApiService
}

type HNActivitySearchQuery = Omit<HNPostSearchParams, 'since' | 'until' | 'minPoints' | 'minRelevanceScore' | 'limit' | 'offset'> & {
  since?: string
  until?: string
  minPoints?: number | string
  minRelevanceScore?: number | string
  limit?: number | string
  offset?: number | string
}

const hnPostTypeValues: HNPostType[] = ['Show HN', 'Ask HN', 'Launch', 'Hiring', 'Other']
const hnSortValues: Array<NonNullable<HNPostSearchParams['sort']>> = ['signal', 'newest']

export const registerHNActivityRoutes = (app: FastifyInstance, options: HNActivityRouteOptions) => {
  app.get(
    '/hn-activity',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            companyId: { type: 'string' },
            companySlug: { type: 'string' },
            companyName: { type: 'string' },
            batch: { type: 'string' },
            industry: { type: 'string' },
            postType: { type: 'string', enum: hnPostTypeValues },
            since: { type: 'string', format: 'date-time' },
            until: { type: 'string', format: 'date-time' },
            minPoints: { type: 'integer', minimum: 0 },
            minRelevanceScore: { type: 'integer', minimum: 0 },
            limit: { type: 'integer', minimum: 0 },
            offset: { type: 'integer', minimum: 0 },
            sort: { type: 'string', enum: hnSortValues }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: HNActivitySearchQuery }>) => {
      const result = await options.hnService.searchHNActivity(toHNPostSearchParams(request.query))

      return {
        total: result.total,
        count: result.data.length,
        posts: result.data.map((post) => ({
          id: post.id,
          companyId: post.companyId,
          company: post.company
            ? {
                id: post.company.id,
                name: post.company.name,
                slug: post.company.slug,
                batch: post.company.batch,
                tags: post.company.tags
              }
            : null,
          hnObjectId: post.hnObjectId,
          hnItemId: post.hnItemId,
          title: post.title,
          url: post.url,
          author: post.author,
          points: post.points,
          comments: post.commentCount,
          relevanceScore: post.relevanceScore,
          matchReasons: post.matchReasons,
          postType: post.postType,
          postedAt: post.postedAt.toISOString(),
          fetchedAt: post.fetchedAt.toISOString()
        }))
      }
    }
  )
}

const toHNPostSearchParams = (query: HNActivitySearchQuery): HNPostSearchParams => ({
  ...(query.companyId ? { companyId: query.companyId } : {}),
  ...(query.companySlug ? { companySlug: query.companySlug } : {}),
  ...(query.companyName ? { companyName: query.companyName } : {}),
  ...(query.batch ? { batch: query.batch } : {}),
  ...(query.industry ? { industry: query.industry } : {}),
  ...(query.postType ? { postType: query.postType } : {}),
  ...(query.since ? { since: new Date(query.since) } : {}),
  ...(query.until ? { until: new Date(query.until) } : {}),
  ...(query.minPoints !== undefined ? { minPoints: Number(query.minPoints) } : {}),
  ...(query.minRelevanceScore !== undefined ? { minRelevanceScore: Number(query.minRelevanceScore) } : {}),
  ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
  ...(query.offset !== undefined ? { offset: Number(query.offset) } : {}),
  ...(query.sort ? { sort: query.sort } : {})
})
