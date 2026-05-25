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
import { HNFetcher, JobBoardFetcher, YCFetcher } from './fetchers'

async function main() {
  const command = process.argv[2]

  if (command !== 'companies' && command !== 'jobs' && command !== 'hn' && command !== 'embeddings') {
    throw new Error(`Unknown pipeline command "${command ?? ''}". Valid commands: companies, jobs, hn, embeddings`)
  }

  const prisma = new PrismaClient()
  try {
    const companyRepo = new PrismaCompanyRepository(prisma)
    const result =
      command === 'companies'
        ? await new YCFetcher(
            companyRepo,
            new PrismaFounderRepository(prisma),
            new PrismaRefreshLogRepository(prisma)
          ).run()
        : command === 'jobs'
          ? await new JobBoardFetcher(companyRepo, new PrismaJobRepository(prisma), {
              maxCompanies: parsePositiveInteger(process.env.JOB_PIPELINE_LIMIT)
            }).run()
          : command === 'hn'
            ? await new HNFetcher(companyRepo, new PrismaHNPostRepository(prisma), {
                maxCompanies: parsePositiveInteger(process.env.HN_PIPELINE_LIMIT),
                lookbackDays: parsePositiveInteger(process.env.HN_LOOKBACK_DAYS),
                maxPagesPerCompany: parsePositiveInteger(process.env.HN_MAX_PAGES_PER_COMPANY)
              }).run()
            : await new EmbeddingService(
                companyRepo,
                new PrismaCompanyEmbeddingRepository(prisma),
                new VoyageEmbeddingProvider(),
                new PrismaJobRepository(prisma),
                new PrismaHNPostRepository(prisma)
              ).refreshCompanyEmbeddings({
                limit: parsePositiveInteger(process.env.EMBEDDING_PIPELINE_LIMIT),
                offset: parsePositiveInteger(process.env.EMBEDDING_PIPELINE_OFFSET),
                staleOnly: process.env.EMBEDDING_PIPELINE_STALE_ONLY === '1'
              })

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

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}
