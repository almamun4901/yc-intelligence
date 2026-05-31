import { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { PrismaCompanyRepository } from '../PrismaCompanyRepository'
import { PrismaHNPostRepository } from '../PrismaHNPostRepository'

const runIntegration = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip

runIntegration('PrismaHNPostRepository', () => {
  const prisma = new PrismaClient()

  it('upserts, searches, and updates sync state', async () => {
    const companyRepo = new PrismaCompanyRepository(prisma)
    const hnRepo = new PrismaHNPostRepository(prisma)
    const company = await companyRepo.upsert({
      name: 'HN Repo Co',
      slug: `hn-repo-co-${Date.now()}`,
      batch: 'W24',
      status: 'Active',
      description: 'Builds launch tools.',
      shortDescription: 'Launch tools',
      website: 'https://example.com',
      teamSize: '1-10',
      isHiring: true,
      tags: ['Developer Tools'],
      location: 'Remote'
    })

    const objectId = `hn-${Date.now()}`
    await hnRepo.upsertMany([
      {
        companyId: company.id,
        hnObjectId: objectId,
        hnItemId: objectId,
        title: 'Show HN: HN Repo Co',
        url: `https://news.ycombinator.com/item?id=${objectId}`,
        author: 'ada',
        points: 25,
        commentCount: 8,
        relevanceScore: 100,
        matchReasons: ['domain:hnrepo.example'],
        postType: 'Show HN',
        postedAt: new Date('2026-05-01T00:00:00.000Z'),
        rawData: { objectID: objectId }
      }
    ])
    await hnRepo.upsertMany([
      {
        companyId: company.id,
        hnObjectId: objectId,
        hnItemId: objectId,
        title: 'Show HN: HN Repo Co updated',
        url: `https://news.ycombinator.com/item?id=${objectId}`,
        author: 'ada',
        points: 30,
        commentCount: 10,
        relevanceScore: 175,
        matchReasons: ['domain:hnrepo.example', 'launch-title:hn repo co'],
        postType: 'Show HN',
        postedAt: new Date('2026-05-01T00:00:00.000Z')
      }
    ])

    const filtered = await hnRepo.search({
      companySlug: company.slug,
      batch: 'W24',
      industry: 'Developer Tools',
      postType: 'Show HN',
      since: new Date('2026-01-01T00:00:00.000Z'),
      minPoints: 10
    })

    expect(filtered.total).toBe(1)
    expect(filtered.data[0]).toMatchObject({
      title: 'Show HN: HN Repo Co updated',
      points: 30,
      relevanceScore: 175,
      matchReasons: ['domain:hnrepo.example', 'launch-title:hn repo co'],
      company: {
        name: 'HN Repo Co',
        slug: company.slug
      }
    })

    const lastSuccessfulSearchAt = new Date('2026-05-24T00:00:00.000Z')
    const syncState = await hnRepo.updateSyncState(company.id, {
      lastFetchedAt: lastSuccessfulSearchAt,
      lastSuccessfulSearchAt,
      lastSeenPostedAt: new Date('2026-05-01T00:00:00.000Z'),
      failureCount: 0,
      lastError: null
    })

    expect(syncState).toMatchObject({
      companyId: company.id,
      lastSuccessfulSearchAt,
      failureCount: 0,
      lastError: null
    })
    await expect(hnRepo.getSyncState(company.id)).resolves.toMatchObject({ companyId: company.id })
  })
})
