import { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { EMBEDDING_DIMENSION } from '../../../lib/embeddingProvider'
import { PrismaCompanyEmbeddingRepository } from '../PrismaCompanyEmbeddingRepository'
import { PrismaCompanyRepository } from '../PrismaCompanyRepository'

const runIntegration = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip

runIntegration('PrismaCompanyEmbeddingRepository', () => {
  const prisma = new PrismaClient()

  it('upserts company embeddings and returns nearest semantic matches', async () => {
    const companyRepo = new PrismaCompanyRepository(prisma)
    const embeddingRepo = new PrismaCompanyEmbeddingRepository(prisma)
    const suffix = Date.now()
    const batch = `T${suffix}`
    const industry = `Developer Tools ${suffix}`
    const firstCompany = await companyRepo.upsert({
      name: 'Embedding Repo AI',
      slug: `embedding-repo-ai-${suffix}`,
      batch,
      status: 'Active',
      description: 'Builds developer infrastructure for AI agents.',
      shortDescription: 'AI agent infrastructure',
      website: 'https://embedding-ai.example',
      teamSize: '1-10',
      isHiring: true,
      tags: [industry, 'AI'],
      location: 'Remote'
    })
    const secondCompany = await companyRepo.upsert({
      name: 'Embedding Repo Finance',
      slug: `embedding-repo-finance-${suffix}`,
      batch,
      status: 'Active',
      description: 'Builds finance workflows.',
      shortDescription: 'Finance workflows',
      website: 'https://embedding-finance.example',
      teamSize: '1-10',
      isHiring: false,
      tags: ['Fintech'],
      location: 'New York'
    })

    await embeddingRepo.upsert({
      companyId: firstCompany.id,
      sourceText: 'AI agent infrastructure',
      sourceHash: `hash-ai-${suffix}`,
      embeddingModel: 'test-model',
      embedding: vectorWithFirstValue(1)
    })
    await embeddingRepo.upsert({
      companyId: secondCompany.id,
      sourceText: 'Finance workflows',
      sourceHash: `hash-finance-${suffix}`,
      embeddingModel: 'test-model',
      embedding: vectorWithSecondValue(1)
    })

    const result = await embeddingRepo.searchSimilar({
      embedding: vectorWithFirstValue(1),
      embeddingModel: 'test-model',
      batch,
      status: 'Active',
      industry,
      isHiring: true,
      limit: 5,
      offset: 0
    })

    expect(result.total).toBe(1)
    expect(result.data[0]?.company.slug).toBe(firstCompany.slug)
    expect(result.data[0]?.score).toBeGreaterThan(0.99)
  })
})

const vectorWithFirstValue = (value: number): number[] => {
  const vector = Array.from({ length: EMBEDDING_DIMENSION }, () => 0)
  vector[0] = value
  return vector
}

const vectorWithSecondValue = (value: number): number[] => {
  const vector = Array.from({ length: EMBEDDING_DIMENSION }, () => 0)
  vector[1] = value
  return vector
}
