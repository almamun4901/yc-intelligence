import { registerCompanyTools, type CompanyToolService, type ToolServer } from './companyTools'
import { registerFounderTools, type FounderToolService } from './founderTools'
import { registerHNTools, type HNToolService } from './hnTools'
import { registerJobTools, type JobToolService } from './jobTools'
import { registerMemoryTools, type MemoryToolService } from './memoryTools'
import { registerSemanticTools, type SemanticToolService } from './semanticTools'

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
  EmbeddingService,
  FounderService,
  PrismaCompanyEmbeddingRepository,
  HNService,
  JobService,
  MemoryService,
  PrismaCompanyRepository,
  PrismaFounderRepository,
  PrismaHNPostRepository,
  PrismaJobRepository,
  PrismaMemoryRepository,
  VoyageEmbeddingProvider,
  createLogger
// eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('@yc-intelligence/core') as {
  CompanyService: new (
    companyRepository: unknown,
    founderRepository: unknown,
    hnPostRepository?: unknown
  ) => CompanyToolService
  FounderService: new (founderRepository: unknown) => FounderToolService
  EmbeddingService: new (
    companyRepository: unknown,
    embeddingRepository: unknown,
    embeddingProvider: unknown,
    jobRepository?: unknown,
    hnPostRepository?: unknown
  ) => SemanticToolService
  VoyageEmbeddingProvider: new () => unknown
  PrismaCompanyEmbeddingRepository: new (prisma: PrismaRuntime) => unknown
  HNService: new (hnPostRepository: unknown) => HNToolService
  JobService: new (jobRepository: unknown) => JobToolService
  MemoryService: new (memoryRepository: unknown) => MemoryToolService
  PrismaCompanyRepository: new (prisma: PrismaRuntime) => unknown
  PrismaFounderRepository: new (prisma: PrismaRuntime) => unknown
  PrismaHNPostRepository: new (prisma: PrismaRuntime) => unknown
  PrismaJobRepository: new (prisma: PrismaRuntime) => unknown
  PrismaMemoryRepository: new (prisma: PrismaRuntime) => unknown
  createLogger: (name: string) => McpLogger
}

export const createYcIntelligenceMcpServer = (
  companyService: CompanyToolService,
  jobService?: JobToolService,
  hnService?: HNToolService,
  semanticService?: SemanticToolService,
  founderService?: FounderToolService,
  memoryService?: MemoryToolService
): RuntimeMcpServer => {
  const server = new McpServer({
    name: 'yc-intelligence',
    version: '0.1.0'
  })

  registerCompanyTools(server, companyService)
  if (jobService) registerJobTools(server, jobService)
  if (hnService) registerHNTools(server, hnService)
  if (semanticService) registerSemanticTools(server, semanticService)
  if (founderService) registerFounderTools(server, founderService)
  if (memoryService) registerMemoryTools(server, memoryService)

  return server
}

export const createProductionMcpServer = (): { server: RuntimeMcpServer; close: () => Promise<void> } => {
  const prisma = new PrismaClient()
  const hnPostRepository = new PrismaHNPostRepository(prisma)
  const founderRepository = new PrismaFounderRepository(prisma)
  const companyService = new CompanyService(
    new PrismaCompanyRepository(prisma),
    founderRepository,
    hnPostRepository
  )
  const founderService = new FounderService(founderRepository)
  const jobService = new JobService(new PrismaJobRepository(prisma))
  const hnService = new HNService(hnPostRepository)
  const memoryService = new MemoryService(new PrismaMemoryRepository(prisma))
  const semanticService = new EmbeddingService(
    new PrismaCompanyRepository(prisma),
    new PrismaCompanyEmbeddingRepository(prisma),
    new VoyageEmbeddingProvider(),
    new PrismaJobRepository(prisma),
    hnPostRepository
  )

  return {
    server: createYcIntelligenceMcpServer(
      companyService,
      jobService,
      hnService,
      semanticService,
      founderService,
      memoryService
    ),
    close: async () => {
      await prisma.$disconnect()
    }
  }
}

export const logger: McpLogger = createLogger('mcp')
