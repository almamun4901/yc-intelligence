import { PrismaClient } from '@prisma/client'
import {
  PrismaCompanyRepository,
  PrismaFounderRepository,
  PrismaJobRepository,
  PrismaRefreshLogRepository
} from '../repositories/impl'
import { JobBoardFetcher, YCFetcher } from './fetchers'

async function main() {
  const command = process.argv[2]

  if (command !== 'companies' && command !== 'jobs') {
    throw new Error(`Unknown pipeline command "${command ?? ''}". Valid commands: companies, jobs`)
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
        : await new JobBoardFetcher(companyRepo, new PrismaJobRepository(prisma), {
            maxCompanies: parsePositiveInteger(process.env.JOB_PIPELINE_LIMIT)
          }).run()

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
