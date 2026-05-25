import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import {
  CompanyService,
  EmbeddingService,
  JobService,
  OpenAIEmbeddingProvider,
  PrismaCompanyEmbeddingRepository,
  PrismaCompanyRepository,
  PrismaFounderRepository,
  PrismaHNPostRepository,
  PrismaJobRepository,
  config,
  createLogger
} from '@yc-intelligence/core'
import { createRedisResponseCache, type ApiLogger, type ResponseCache } from './cache'
import { registerCompanyRoutes, type CompanyApiService } from './routes/companies'
import { registerJobRoutes, type JobApiService } from './routes/jobs'
import { registerSemanticSearchRoutes, type SemanticSearchApiService } from './routes/semanticSearch'

interface ServerOptions {
  companyService?: CompanyApiService
  jobService?: JobApiService
  semanticSearchService?: SemanticSearchApiService
  cache?: ResponseCache
  logger?: ApiLogger
}

export const buildServer = (options: ServerOptions = {}) => {
  const logger = options.logger ?? createLogger('api')
  const app = Fastify()

  app.get('/health', async () => ({ ok: true }))

  if (options.companyService) {
    registerCompanyRoutes(app, {
      companyService: options.companyService,
      cache: options.cache,
      logger
    })
  }

  if (options.jobService) {
    registerJobRoutes(app, {
      jobService: options.jobService
    })
  }

  if (options.semanticSearchService) {
    registerSemanticSearchRoutes(app, {
      semanticSearchService: options.semanticSearchService
    })
  }

  if (options.cache) {
    app.addHook('onClose', async () => {
      await options.cache?.close()
    })
  }

  return app
}

export const createProductionServer = () => {
  const prisma = new PrismaClient()
  const hnPostRepository = new PrismaHNPostRepository(prisma)
  const companyService = new CompanyService(
    new PrismaCompanyRepository(prisma),
    new PrismaFounderRepository(prisma),
    hnPostRepository
  )
  const jobService = new JobService(new PrismaJobRepository(prisma))
  const semanticSearchService = new EmbeddingService(
    new PrismaCompanyRepository(prisma),
    new PrismaCompanyEmbeddingRepository(prisma),
    new OpenAIEmbeddingProvider(),
    new PrismaJobRepository(prisma),
    hnPostRepository
  )
  const logger = createLogger('api')
  const cache = createRedisResponseCache(config.REDIS_URL, logger)
  const app = buildServer({ companyService, jobService, semanticSearchService, cache, logger })

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  return app
}

if (require.main === module) {
  const logger = createLogger('api')
  const port = Number(process.env.PORT ?? 3001)

  createProductionServer()
    .listen({ port, host: '0.0.0.0' })
    .then((address) => logger.info({ address }, 'API server listening'))
    .catch((err) => {
      logger.error({ err }, 'API server failed to start')
      process.exit(1)
    })
}
