#!/usr/bin/env node

import { createProductionMcpServer, logger } from './server'

export * from './companyTools'
export * from './hnTools'
export * from './jobTools'
export * from './memoryTools'
export * from './server'

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js') as {
    StdioServerTransport: new () => unknown
  }
  const { server, close } = createProductionMcpServer()
  const transport = new StdioServerTransport()

  server
    .connect(transport)
    .then(() => logger.info('YC Intelligence MCP server listening on stdio'))
    .catch(async (err) => {
      logger.error({ err }, 'YC Intelligence MCP server failed to start')
      await close()
      process.exit(1)
    })

  process.on('SIGINT', () => {
    close()
      .catch((err) => logger.error({ err }, 'Failed to close MCP resources'))
      .finally(() => process.exit(0))
  })
}
