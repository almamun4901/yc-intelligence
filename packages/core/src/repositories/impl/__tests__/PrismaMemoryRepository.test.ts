import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaMemoryRepository } from '../PrismaMemoryRepository'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'

;(runIntegration ? describe : describe.skip)('PrismaMemoryRepository integration', () => {
  const prisma = new PrismaClient()
  const repo = new PrismaMemoryRepository(prisma)

  beforeEach(async () => {
    await prisma.memorySource.deleteMany()
    await prisma.memoryEntry.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates memory entries with sources', async () => {
    const entry = await repo.create({
      type: 'decision',
      title: 'Memory belongs to project context',
      body: 'Company intelligence uses separate models.',
      tags: ['boundary'],
      sources: [{ sourceType: 'file', sourceRef: 'plans/technical-plan.md' }]
    })

    expect(entry.id).toBeTruthy()
    expect(entry.sources).toHaveLength(1)
    expect(entry.sources[0].sourceRef).toBe('plans/technical-plan.md')
  })

  it('searches by text, type, tags, and status', async () => {
    await repo.create({
      type: 'decision',
      title: 'Use monorepo',
      body: 'Core owns business logic.',
      tags: ['architecture']
    })
    await repo.create({
      type: 'open_question',
      title: 'Later pipeline',
      body: 'How do jobs refresh?',
      tags: ['pipeline'],
      status: 'archived'
    })

    const result = await repo.search({
      query: 'business',
      type: 'decision',
      tags: ['architecture'],
      status: 'active'
    })

    expect(result.total).toBe(1)
    expect(result.data[0].title).toBe('Use monorepo')
  })

  it('supersedes old memory in both directions', async () => {
    const oldEntry = await repo.create({
      type: 'decision',
      title: 'Old',
      body: 'Single package'
    })

    const newEntry = await repo.supersede(oldEntry.id, {
      type: 'decision',
      title: 'New',
      body: 'Monorepo'
    })

    const refreshedOldEntry = await repo.findById(oldEntry.id)

    expect(newEntry.supersedesId).toBe(oldEntry.id)
    expect(refreshedOldEntry?.status).toBe('superseded')
    expect(refreshedOldEntry?.supersededById).toBe(newEntry.id)
  })
})
