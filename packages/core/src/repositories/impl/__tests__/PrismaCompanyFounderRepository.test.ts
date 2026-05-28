import { PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'
import { PrismaCompanyRepository } from '../PrismaCompanyRepository'
import { PrismaFounderRepository } from '../PrismaFounderRepository'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'

;(runIntegration ? describe : describe.skip)('Prisma company and founder repositories integration', () => {
  const prisma = new PrismaClient()
  const companyRepo = new PrismaCompanyRepository(prisma)
  const founderRepo = new PrismaFounderRepository(prisma)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('upserts and updates companies by slug', async () => {
    const slug = testSlug('acme')
    const created = await companyRepo.upsert(makeCompany({ name: 'Original', slug }))
    const updated = await companyRepo.upsert(makeCompany({ name: 'Updated', slug }))

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('Updated')
    expect(await prisma.company.count({ where: { slug } })).toBe(1)
  })

  it('searches by batch, status, hiring flag, and tag', async () => {
    const suffix = Date.now()
    const batch = `T${suffix}`
    const industry = `Integration AI ${suffix}`
    await companyRepo.upsert(
      makeCompany({ name: 'Hiring AI', slug: testSlug('hiring-ai'), batch, tags: [industry] })
    )
    await companyRepo.upsert(
      makeCompany({
        name: 'Inactive Bio',
        slug: testSlug('inactive-bio'),
        batch,
        status: 'Inactive',
        isHiring: false,
        tags: ['Bio']
      })
    )

    const result = await companyRepo.search({
      batch,
      status: 'Active',
      isHiring: true,
      industry
    })

    expect(result.total).toBe(1)
    expect(result.data[0].slug).toBe('hiring-ai')
  })

  it('upserts founders idempotently and cascades deletes from company', async () => {
    const company = await companyRepo.upsert(makeCompany({ slug: testSlug('founder-co') }))

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
    expect(await founderRepo.findByCompanyId(company.id)).toHaveLength(0)
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

function testSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
