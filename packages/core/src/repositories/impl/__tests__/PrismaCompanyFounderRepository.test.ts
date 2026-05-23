import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaCompanyRepository } from '../PrismaCompanyRepository'
import { PrismaFounderRepository } from '../PrismaFounderRepository'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'

;(runIntegration ? describe : describe.skip)('Prisma company and founder repositories integration', () => {
  const prisma = new PrismaClient()
  const companyRepo = new PrismaCompanyRepository(prisma)
  const founderRepo = new PrismaFounderRepository(prisma)

  beforeEach(async () => {
    await prisma.founder.deleteMany()
    await prisma.company.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('upserts and updates companies by slug', async () => {
    const created = await companyRepo.upsert(makeCompany({ name: 'Original', slug: 'acme' }))
    const updated = await companyRepo.upsert(makeCompany({ name: 'Updated', slug: 'acme' }))

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('Updated')
    expect(await prisma.company.count()).toBe(1)
  })

  it('searches by batch, status, hiring flag, and tag', async () => {
    await companyRepo.upsert(
      makeCompany({ name: 'Hiring AI', slug: 'hiring-ai', batch: 'W24', tags: ['AI'] })
    )
    await companyRepo.upsert(
      makeCompany({
        name: 'Inactive Bio',
        slug: 'inactive-bio',
        batch: 'S23',
        status: 'Inactive',
        isHiring: false,
        tags: ['Bio']
      })
    )

    const result = await companyRepo.search({
      batch: 'W24',
      status: 'Active',
      isHiring: true,
      industry: 'AI'
    })

    expect(result.total).toBe(1)
    expect(result.data[0].slug).toBe('hiring-ai')
  })

  it('upserts founders idempotently and cascades deletes from company', async () => {
    const company = await companyRepo.upsert(makeCompany({ slug: 'founder-co' }))

    await founderRepo.upsertMany([
      { companyId: company.id, name: 'Ada Lovelace', linkedinUrl: null }
    ])
    await founderRepo.upsertMany([
      { companyId: company.id, name: 'Ada Lovelace', linkedinUrl: 'https://linkedin.com/in/ada' }
    ])

    const founders = await founderRepo.findByCompanyId(company.id)
    expect(founders).toHaveLength(1)
    expect(founders[0].linkedinUrl).toBe('https://linkedin.com/in/ada')

    await prisma.company.delete({ where: { id: company.id } })
    expect(await prisma.founder.count()).toBe(0)
  })
})

function makeCompany(overrides: Partial<Parameters<PrismaCompanyRepository['upsert']>[0]> = {}) {
  return {
    name: 'Acme',
    slug: 'acme',
    batch: 'W24',
    status: 'Active' as const,
    description: 'A company',
    shortDescription: 'A short line',
    website: 'https://example.com',
    teamSize: '1-10' as const,
    isHiring: true,
    tags: ['AI'],
    location: 'San Francisco',
    rawData: {},
    ...overrides
  }
}
