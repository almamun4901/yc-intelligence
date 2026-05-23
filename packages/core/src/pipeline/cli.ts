import { PrismaClient } from '@prisma/client'
import { PrismaCompanyRepository, PrismaFounderRepository, PrismaRefreshLogRepository } from '../repositories/impl'
import { YCFetcher } from './fetchers'

async function main() {
  const command = process.argv[2]

  if (command !== 'companies') {
    throw new Error(`Unknown pipeline command "${command ?? ''}". Valid commands: companies`)
  }

  const prisma = new PrismaClient()
  try {
    const companyRepo = new PrismaCompanyRepository(prisma)
    const founderRepo = new PrismaFounderRepository(prisma)
    const refreshLogRepo = new PrismaRefreshLogRepository(prisma)
    const fetcher = new YCFetcher(companyRepo, founderRepo, refreshLogRepo)
    const result = await fetcher.run()

    process.stdout.write(`YC companies pipeline complete: ${JSON.stringify(result)}\n`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`YC companies pipeline failed: ${message}\n`)
  process.exit(1)
})
