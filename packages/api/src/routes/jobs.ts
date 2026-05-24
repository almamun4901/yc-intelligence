import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { JobSearchParams, JobService } from '@yc-intelligence/core'

export type JobApiService = Pick<JobService, 'searchJobs'>

export interface JobRouteOptions {
  jobService: JobApiService
}

type JobSearchQuery = Omit<JobSearchParams, 'techStack' | 'isRemote' | 'limit' | 'offset'> & {
  techStack?: string | string[]
  isRemote?: boolean | string
  limit?: number | string
  offset?: number | string
}

export const registerJobRoutes = (app: FastifyInstance, options: JobRouteOptions) => {
  app.get(
    '/jobs',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            techStack: {
              anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }]
            },
            title: { type: 'string' },
            companyId: { type: 'string' },
            isRemote: { type: 'boolean' },
            batch: { type: 'string' },
            industry: { type: 'string' },
            limit: { type: 'integer', minimum: 0 },
            offset: { type: 'integer', minimum: 0 }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: JobSearchQuery }>) => {
      const result = await options.jobService.searchJobs(toJobSearchParams(request.query))

      return {
        total: result.total,
        count: result.data.length,
        jobs: result.data.map((job) => ({
          id: job.id,
          companyId: job.companyId,
          title: job.title,
          location: job.location,
          isRemote: job.isRemote,
          techStack: job.techStack,
          atsSource: job.atsSource,
          applyUrl: job.applyUrl,
          isActive: job.isActive,
          postedAt: job.postedAt?.toISOString() ?? null,
          fetchedAt: job.fetchedAt.toISOString()
        }))
      }
    }
  )
}

const toJobSearchParams = (query: JobSearchQuery): JobSearchParams => ({
  ...(query.techStack !== undefined ? { techStack: normalizeTechStack(query.techStack) } : {}),
  ...(query.title ? { title: query.title } : {}),
  ...(query.companyId ? { companyId: query.companyId } : {}),
  ...(query.isRemote !== undefined ? { isRemote: query.isRemote === true || query.isRemote === 'true' } : {}),
  ...(query.batch ? { batch: query.batch } : {}),
  ...(query.industry ? { industry: query.industry } : {}),
  ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
  ...(query.offset !== undefined ? { offset: Number(query.offset) } : {})
})

const normalizeTechStack = (value: string | string[]): string[] =>
  (Array.isArray(value) ? value : value.split(',')).map((tech) => tech.trim()).filter(Boolean)
