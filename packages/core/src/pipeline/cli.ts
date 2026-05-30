import { PrismaClient } from '@prisma/client'
import { VoyageEmbeddingProvider } from '../lib/embeddingProvider'
import {
  PrismaCompanyEmbeddingRepository,
  PrismaCompanyRepository,
  PrismaFounderRepository,
  PrismaHNPostRepository,
  PrismaJobRepository,
  PrismaRefreshLogRepository
} from '../repositories/impl'
import { EmbeddingService } from '../services'
import { HNFetcher, JobBoardFetcher, YCFetcher, YCFounderEnricher } from './fetchers'
import {
  createEmbeddingRefreshOptions,
  createFounderEnricherOptions,
  createHNFetcherOptions,
  createJobFetcherOptions,
  createPipelineRunOptions,
  createPipelineRuntimeOptions,
  createPipelineSchedulerOptions,
  PipelineOrchestrator,
  PipelineScheduler,
  type PipelineStage
} from './index'

const STAGE_COMMANDS = ['companies', 'founders', 'jobs', 'hn', 'embeddings'] as const
const RUN_COMMANDS = ['seed', 'refresh', 'schedule'] as const
type StageCommand = (typeof STAGE_COMMANDS)[number]
type RunCommand = (typeof RUN_COMMANDS)[number]
type PipelineCommand = StageCommand | RunCommand

async function main() {
  const command = parseCommand(process.argv[2])

  if (!command) return

  const prisma = new PrismaClient()
  try {
    const companyRepo = new PrismaCompanyRepository(prisma)
    const founderRepo = new PrismaFounderRepository(prisma)
    const runtimeOptions = createPipelineRuntimeOptions()
    const orchestrator = new PipelineOrchestrator({
      companies: new YCFetcher(
        companyRepo,
        founderRepo,
        new PrismaRefreshLogRepository(prisma)
      ),
      founders: new YCFounderEnricher(companyRepo, founderRepo, createFounderEnricherOptions(runtimeOptions)),
      jobs: new JobBoardFetcher(companyRepo, new PrismaJobRepository(prisma), createJobFetcherOptions(runtimeOptions)),
      hn: new HNFetcher(companyRepo, new PrismaHNPostRepository(prisma), createHNFetcherOptions(runtimeOptions)),
      embeddings: {
        run: () =>
          new EmbeddingService(
            companyRepo,
            new PrismaCompanyEmbeddingRepository(prisma),
            new VoyageEmbeddingProvider(),
            new PrismaJobRepository(prisma),
            new PrismaHNPostRepository(prisma)
          ).refreshCompanyEmbeddings(createEmbeddingRefreshOptions(runtimeOptions))
      }
    })

    if (isStageCommand(command)) {
      const result = await orchestrator.run('refresh', { stages: [command] })
      process.stdout.write(`YC ${command} pipeline complete: ${JSON.stringify(result.stages[0]?.result ?? null)}\n`)
      return
    }

    if (command === 'schedule') {
      const scheduler = new PipelineScheduler(orchestrator, {
        ...createPipelineSchedulerOptions(),
        runOptions: createPipelineRunOptions()
      })
      scheduler.start()
      await waitForShutdown(scheduler)
      return
    }

    const result = command === 'seed'
      ? await orchestrator.seed(createPipelineRunOptions())
      : await orchestrator.refresh(createPipelineRunOptions())
    process.stdout.write(`YC ${command} pipeline complete: ${JSON.stringify(result)}\n`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`YC pipeline failed: ${message}\n`)
  process.exit(1)
})

function parseCommand(command: string | undefined): PipelineCommand | null {
  if (isPipelineCommand(command)) return command

  throw new Error(
    `Unknown pipeline command "${command ?? ''}". Valid commands: ${[...STAGE_COMMANDS, ...RUN_COMMANDS].join(', ')}`
  )
}

function isPipelineCommand(command: string | undefined): command is PipelineCommand {
  return isStageCommand(command) || RUN_COMMANDS.includes(command as RunCommand)
}

function isStageCommand(command: string | undefined): command is PipelineStage & StageCommand {
  return STAGE_COMMANDS.includes(command as StageCommand)
}

function waitForShutdown(scheduler: PipelineScheduler): Promise<void> {
  return new Promise((resolve) => {
    const shutdown = () => {
      scheduler.stop()
      resolve()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}
