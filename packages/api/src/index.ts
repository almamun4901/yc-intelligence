import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import {
  CompanyService,
  PrismaCompanyRepository,
  PrismaFounderRepository,
  config,
  createLogger
} from '@yc-intelligence/core'
import { createRedisResponseCache, type ApiLogger, type ResponseCache } from './cache'
import { registerCompanyRoutes, type CompanyApiService } from './routes/companies'

interface ServerOptions {
  companyService?: CompanyApiService
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

  if (options.cache) {
    app.addHook('onClose', async () => {
      await options.cache?.close()
    })
  }

  return app
}

export const createProductionServer = () => {
  const prisma = new PrismaClient()
  const companyService = new CompanyService(
    new PrismaCompanyRepository(prisma),
    new PrismaFounderRepository(prisma)
  )
  const logger = createLogger('api')
  const cache = createRedisResponseCache(config.REDIS_URL, logger)
  const app = buildServer({ companyService, cache, logger })

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
