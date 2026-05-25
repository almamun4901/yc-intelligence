import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { EmbeddingService, SemanticCompanySearchParams } from '@yc-intelligence/core'

export type SemanticSearchApiService = Pick<EmbeddingService, 'semanticSearch'>

export interface SemanticSearchRouteOptions {
  semanticSearchService: SemanticSearchApiService
}

type SemanticSearchQuery = Omit<SemanticCompanySearchParams, 'isHiring' | 'limit' | 'offset'> & {
  isHiring?: boolean | string
  limit?: number | string
  offset?: number | string
}

const companyStatusValues = ['Active', 'Acquired', 'Inactive', 'Dead']

export const registerSemanticSearchRoutes = (app: FastifyInstance, options: SemanticSearchRouteOptions) => {
  app.get(
    '/search/semantic',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['query'],
          additionalProperties: false,
          properties: {
            query: { type: 'string', minLength: 1 },
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
    async (request: FastifyRequest<{ Querystring: SemanticSearchQuery }>) => {
      const result = await options.semanticSearchService.semanticSearch(toSemanticSearchParams(request.query))

      return {
        total: result.total,
        count: result.data.length,
        companies: result.data.map(({ company, score }) => ({
          name: company.name,
          slug: company.slug,
          score,
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
    }
  )
}

const toSemanticSearchParams = (query: SemanticSearchQuery): SemanticCompanySearchParams => ({
  query: query.query,
  ...(query.batch ? { batch: query.batch } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.industry ? { industry: query.industry } : {}),
  ...(query.isHiring !== undefined ? { isHiring: query.isHiring === true || query.isHiring === 'true' } : {}),
  ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
  ...(query.offset !== undefined ? { offset: Number(query.offset) } : {})
})
