import Fastify from 'fastify'
import { createLogger } from '@yc-intelligence/core'

export const buildServer = () => {
  const app = Fastify()

  app.get('/health', async () => ({ ok: true }))

  return app
}

if (require.main === module) {
  const logger = createLogger('api')
  const port = Number(process.env.PORT ?? 3001)

  buildServer()
    .listen({ port, host: '0.0.0.0' })
    .then((address) => logger.info({ address }, 'API server listening'))
    .catch((err) => {
      logger.error({ err }, 'API server failed to start')
      process.exit(1)
    })
}
