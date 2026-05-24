import { registerCompanyTools, type CompanyToolService, type ToolServer } from './companyTools'

interface RuntimeMcpServer extends ToolServer {
  connect(transport: unknown): Promise<void>
  close(): Promise<void>
}

interface McpLogger {
  info(message: string): void
  error(value: unknown, message?: string): void
}

interface PrismaRuntime {
  $disconnect(): Promise<void>
}

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js') as {
  McpServer: new (serverInfo: { name: string; version: string }) => RuntimeMcpServer
}
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: new () => PrismaRuntime
}
const {
  CompanyService,
  PrismaCompanyRepository,
  PrismaFounderRepository,
  createLogger
} = require('@yc-intelligence/core') as {
  CompanyService: new (companyRepository: unknown, founderRepository: unknown) => CompanyToolService
  PrismaCompanyRepository: new (prisma: PrismaRuntime) => unknown
  PrismaFounderRepository: new (prisma: PrismaRuntime) => unknown
  createLogger: (name: string) => McpLogger
}

export const createYcIntelligenceMcpServer = (companyService: CompanyToolService): RuntimeMcpServer => {
  const server = new McpServer({
    name: 'yc-intelligence',
    version: '0.1.0'
  })

  registerCompanyTools(server, companyService)

  return server
}

export const createProductionMcpServer = (): { server: RuntimeMcpServer; close: () => Promise<void> } => {
  const prisma = new PrismaClient()
  const companyService = new CompanyService(
    new PrismaCompanyRepository(prisma),
    new PrismaFounderRepository(prisma)
  )

  return {
    server: createYcIntelligenceMcpServer(companyService),
    close: async () => {
      await prisma.$disconnect()
    }
  }
}

export const logger: McpLogger = createLogger('mcp')
