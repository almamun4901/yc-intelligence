import { isAxiosError } from 'axios'
import { PrismaClient } from '@prisma/client'
import { VoyageEmbeddingProvider } from '../lib/embeddingProvider'
import {
  PrismaCompanyEmbeddingRepository,
  PrismaCompanyRepository,
  PrismaHNPostRepository,
  PrismaJobRepository
} from '../repositories/impl'
import { EmbeddingService } from '../services'

async function main() {
  const prisma = new PrismaClient()

  try {
    const companyRepository = new PrismaCompanyRepository(prisma)
    const embeddingRepository = new PrismaCompanyEmbeddingRepository(prisma)
    const embeddingProvider = new VoyageEmbeddingProvider()
    const service = new EmbeddingService(
      companyRepository,
      embeddingRepository,
      embeddingProvider,
      new PrismaJobRepository(prisma),
      new PrismaHNPostRepository(prisma)
    )

    const limit = parsePositiveInteger(process.env.SEMANTIC_SMOKE_LIMIT) ?? 5
    const query = process.env.SEMANTIC_SMOKE_QUERY?.trim() || 'AI infrastructure for developers'
    const refresh = await service.refreshCompanyEmbeddings({ limit })
    const search = await service.semanticSearch({ query, limit: 5 })

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        query,
        refresh,
        search: {
          total: search.total,
          count: search.data.length,
          companies: search.data.map(({ company, score }) => ({
            name: company.name,
            slug: company.slug,
            batch: company.batch,
            status: company.status,
            score
          }))
        }
      })}\n`
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  const message = toSmokeErrorMessage(error)
  process.stderr.write(`Semantic smoke failed: ${message}\n`)
  process.exit(1)
})

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function toSmokeErrorMessage(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 401) {
    return 'Voyage embeddings request was unauthorized. Check VOYAGE_API_KEY in .env and rerun `pnpm --filter @yc-intelligence/core smoke:semantic`.'
  }

  return error instanceof Error ? error.message : String(error)
}
