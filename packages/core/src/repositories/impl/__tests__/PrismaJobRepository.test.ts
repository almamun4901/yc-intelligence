import { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { PrismaCompanyRepository } from '../PrismaCompanyRepository'
import { PrismaJobRepository } from '../PrismaJobRepository'

const runIntegration = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip

runIntegration('PrismaJobRepository', () => {
  const prisma = new PrismaClient()

  it('upserts, searches, and marks missing jobs inactive', async () => {
    const companyRepo = new PrismaCompanyRepository(prisma)
    const jobRepo = new PrismaJobRepository(prisma)
    const suffix = Date.now()
    const batch = `T${suffix}`
    const industry = `Developer Tools ${suffix}`
    const company = await companyRepo.upsert({
      name: 'Job Repo Co',
      slug: `job-repo-co-${suffix}`,
      batch,
      status: 'Active',
      description: 'Builds hiring tools.',
      shortDescription: 'Hiring tools',
      website: 'https://example.com',
      teamSize: '1-10',
      isHiring: true,
      tags: [industry],
      location: 'Remote'
    })

    const firstApplyUrl = `https://example.com/jobs/backend-${suffix}`
    const secondApplyUrl = `https://example.com/jobs/frontend-${suffix}`
    await jobRepo.upsertMany([
      {
        companyId: company.id,
        title: 'Backend Engineer',
        location: 'Remote',
        isRemote: true,
        description: 'Rust and PostgreSQL role',
        techStack: ['rust', 'postgresql'],
        atsSource: 'greenhouse',
        applyUrl: firstApplyUrl,
        isActive: true,
        postedAt: new Date('2026-05-01T00:00:00.000Z')
      },
      {
        companyId: company.id,
        title: 'Frontend Engineer',
        location: 'San Francisco',
        isRemote: false,
        description: 'React role',
        techStack: ['react'],
        atsSource: 'lever',
        applyUrl: secondApplyUrl,
        isActive: true,
        postedAt: null
      }
    ])

    const filtered = await jobRepo.search({
      techStack: ['rust'],
      isRemote: true,
      batch,
      industry,
      isActive: true
    })
    expect(filtered.total).toBe(1)
    expect(filtered.data[0]?.title).toBe('Backend Engineer')

    await expect(jobRepo.markInactiveForCompany(company.id, [firstApplyUrl])).resolves.toBe(1)
    const inactive = await jobRepo.search({ companyId: company.id, isActive: false })
    expect(inactive.data.map((job) => job.applyUrl)).toContain(secondApplyUrl)

    const syncState = await jobRepo.updateSyncState(company.id, {
      lastFetchedAt: new Date('2026-05-25T12:00:00.000Z'),
      lastSuccessfulFetchAt: new Date('2026-05-25T12:00:00.000Z'),
      lastFoundJobsAt: new Date('2026-05-25T12:00:00.000Z'),
      lastAtsSource: 'greenhouse',
      lastStatus: 'found_jobs',
      failureCount: 0,
      lastError: null
    })
    expect(syncState).toMatchObject({
      companyId: company.id,
      lastAtsSource: 'greenhouse',
      lastStatus: 'found_jobs',
      failureCount: 0,
      lastError: null
    })

    const foundSyncState = await jobRepo.getSyncState(company.id)
    expect(foundSyncState).toMatchObject({
      companyId: company.id,
      lastAtsSource: 'greenhouse',
      lastStatus: 'found_jobs'
    })
  })
})
