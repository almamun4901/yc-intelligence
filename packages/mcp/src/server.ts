import { registerCompanyTools, type CompanyToolService, type ToolServer } from './companyTools'
import { registerHNTools, type HNToolService } from './hnTools'
import { registerJobTools, type JobToolService } from './jobTools'

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js') as {
  McpServer: new (serverInfo: { name: string; version: string }) => RuntimeMcpServer
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: new () => PrismaRuntime
}
const {
  CompanyService,
  HNService,
  JobService,
  PrismaCompanyRepository,
  PrismaFounderRepository,
  PrismaHNPostRepository,
  PrismaJobRepository,
  createLogger
// eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('@yc-intelligence/core') as {
  CompanyService: new (
    companyRepository: unknown,
    founderRepository: unknown,
    hnPostRepository?: unknown
  ) => CompanyToolService
  HNService: new (hnPostRepository: unknown) => HNToolService
  JobService: new (jobRepository: unknown) => JobToolService
  PrismaCompanyRepository: new (prisma: PrismaRuntime) => unknown
  PrismaFounderRepository: new (prisma: PrismaRuntime) => unknown
  PrismaHNPostRepository: new (prisma: PrismaRuntime) => unknown
  PrismaJobRepository: new (prisma: PrismaRuntime) => unknown
  createLogger: (name: string) => McpLogger
}

export const createYcIntelligenceMcpServer = (
  companyService: CompanyToolService,
  jobService?: JobToolService,
  hnService?: HNToolService
): RuntimeMcpServer => {
  const server = new McpServer({
    name: 'yc-intelligence',
    version: '0.1.0'
  })

  registerCompanyTools(server, companyService)
  if (jobService) registerJobTools(server, jobService)
  if (hnService) registerHNTools(server, hnService)

  return server
}

export const createProductionMcpServer = (): { server: RuntimeMcpServer; close: () => Promise<void> } => {
  const prisma = new PrismaClient()
  const hnPostRepository = new PrismaHNPostRepository(prisma)
  const companyService = new CompanyService(
    new PrismaCompanyRepository(prisma),
    new PrismaFounderRepository(prisma),
    hnPostRepository
  )
  const jobService = new JobService(new PrismaJobRepository(prisma))
  const hnService = new HNService(hnPostRepository)

  return {
    server: createYcIntelligenceMcpServer(companyService, jobService, hnService),
    close: async () => {
      await prisma.$disconnect()
    }
  }
}

export const logger: McpLogger = createLogger('mcp')
