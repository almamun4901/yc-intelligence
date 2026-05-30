import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { FounderSearchParams, FounderService } from '@yc-intelligence/core'

export type FounderApiService = Pick<FounderService, 'searchFounders'>

export interface FounderRouteOptions {
  founderService: FounderApiService
}

type FounderSearchQuery = Omit<FounderSearchParams, 'limit' | 'offset'> & {
  limit?: number | string
  offset?: number | string
}

export const registerFounderRoutes = (app: FastifyInstance, options: FounderRouteOptions) => {
  app.get(
    '/founders',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string' },
            companyId: { type: 'string' },
            company: { type: 'string' },
            batch: { type: 'string' },
            industry: { type: 'string' },
            previousEmployer: { type: 'string' },
            school: { type: 'string' },
            limit: { type: 'integer', minimum: 0 },
            offset: { type: 'integer', minimum: 0 }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: FounderSearchQuery }>) => {
      const result = await options.founderService.searchFounders(toFounderSearchParams(request.query))

      return {
        total: result.total,
        count: result.data.length,
        founders: result.data.map((founder) => ({
          id: founder.id,
          companyId: founder.companyId,
          name: founder.name,
          linkedinUrl: founder.linkedinUrl,
          previousEmployers: founder.previousEmployers,
          schools: founder.schools,
          company: {
            name: founder.company.name,
            slug: founder.company.slug,
            batch: founder.company.batch,
            status: founder.company.status,
            shortDescription: founder.company.shortDescription,
            website: founder.company.website,
            isHiring: founder.company.isHiring,
            tags: founder.company.tags,
            location: founder.company.location
          },
          createdAt: founder.createdAt.toISOString()
        }))
      }
    }
  )
}

const toFounderSearchParams = (query: FounderSearchQuery): FounderSearchParams => ({
  ...(query.query ? { query: query.query } : {}),
  ...(query.companyId ? { companyId: query.companyId } : {}),
  ...(query.company ? { company: query.company } : {}),
  ...(query.batch ? { batch: query.batch } : {}),
  ...(query.industry ? { industry: query.industry } : {}),
  ...(query.previousEmployer ? { previousEmployer: query.previousEmployer } : {}),
  ...(query.school ? { school: query.school } : {}),
  ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
  ...(query.offset !== undefined ? { offset: Number(query.offset) } : {})
})
