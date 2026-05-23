import { describe, expect, it } from 'vitest'
import type { MemoryEntry, MemorySource, MemoryStatus } from '../../domain'
import type {
  CreateMemoryEntryInput,
  CreateMemorySourceInput,
  IMemoryRepository
} from '../../repositories'
import { MEMORY_SOURCE_EXCERPT_MAX_LENGTH, MemoryService } from '../MemoryService'

describe('MemoryService', () => {
  it('creates normalized project memory with capped source excerpts', async () => {
    const repo = new InMemoryMemoryRepository()
    const service = new MemoryService(repo)
    const longExcerpt = 'x'.repeat(MEMORY_SOURCE_EXCERPT_MAX_LENGTH + 25)

    const entry = await service.addMemory({
      type: 'decision',
      title: '  Use technical plan architecture  ',
      body: '  Keep MCP adapters thin.  ',
      tags: [' architecture ', 'phase-1', 'architecture'],
      confidence: 0.9,
      sources: [
        {
          sourceType: 'file',
          sourceRef: 'plans/technical-plan.md',
          sourceExcerpt: longExcerpt
        }
      ]
    })

    expect(entry.title).toBe('Use technical plan architecture')
    expect(entry.body).toBe('Keep MCP adapters thin.')
    expect(entry.tags).toEqual(['architecture', 'phase-1'])
    expect(entry.sources[0].sourceExcerpt).toHaveLength(MEMORY_SOURCE_EXCERPT_MAX_LENGTH)
  })

  it('searches active memories by default', async () => {
    const repo = new InMemoryMemoryRepository()
    const service = new MemoryService(repo)

    await service.addMemory({ type: 'decision', title: 'Active', body: 'Current', status: 'active' })
    await service.addMemory({ type: 'decision', title: 'Archived', body: 'Old', status: 'archived' })
    await service.addMemory({ type: 'decision', title: 'Superseded', body: 'Old', status: 'superseded' })

    const result = await service.searchMemory({})

    expect(result.total).toBe(1)
    expect(result.data[0].title).toBe('Active')
  })

  it('filters by query, type, tags, status, limit, and offset', async () => {
    const repo = new InMemoryMemoryRepository()
    const service = new MemoryService(repo)

    await service.addMemory({
      type: 'decision',
      title: 'Architecture choice',
      body: 'Use repositories',
      tags: ['architecture', 'phase-1']
    })
    await service.addMemory({
      type: 'open_question',
      title: 'Pipeline question',
      body: 'How should jobs refresh?',
      tags: ['pipeline']
    })

    const result = await service.searchMemory({
      query: 'repositories',
      type: 'decision',
      tags: ['architecture'],
      status: 'active',
      limit: 1,
      offset: 0
    })

    expect(result.total).toBe(1)
    expect(result.data[0].title).toBe('Architecture choice')
  })

  it('rejects invalid confidence values', async () => {
    const service = new MemoryService(new InMemoryMemoryRepository())

    await expect(
      service.addMemory({
        type: 'decision',
        title: 'Bad confidence',
        body: 'This should fail',
        confidence: 1.5
      })
    ).rejects.toThrow('between 0 and 1')
  })

  it('supersedes memory in both directions', async () => {
    const repo = new InMemoryMemoryRepository()
    const service = new MemoryService(repo)

    const oldEntry = await service.addMemory({
      type: 'decision',
      title: 'Old architecture',
      body: 'Single package'
    })

    const newEntry = await service.supersedeMemory(oldEntry.id, {
      type: 'decision',
      title: 'New architecture',
      body: 'Monorepo'
    })

    const refreshedOldEntry = await service.findById(oldEntry.id)

    expect(newEntry.supersedesId).toBe(oldEntry.id)
    expect(refreshedOldEntry?.status).toBe('superseded')
    expect(refreshedOldEntry?.supersededById).toBe(newEntry.id)
  })
})

class InMemoryMemoryRepository implements IMemoryRepository {
  private entries: MemoryEntry[] = []

  async create(input: CreateMemoryEntryInput): Promise<MemoryEntry> {
    const entry = this.makeEntry(input)
    this.entries.push(entry)
    return entry
  }

  async findById(id: string): Promise<MemoryEntry | null> {
    return this.entries.find((entry) => entry.id === id) ?? null
  }

  async search(params: Parameters<IMemoryRepository['search']>[0]) {
    let data = [...this.entries]

    if (params.query) {
      const query = params.query.toLowerCase()
      data = data.filter(
        (entry) => entry.title.toLowerCase().includes(query) || entry.body.toLowerCase().includes(query)
      )
    }
    if (params.type) data = data.filter((entry) => entry.type === params.type)
    if (params.status) data = data.filter((entry) => entry.status === params.status)
    if (params.tags?.length) {
      data = data.filter((entry) => params.tags?.every((tag) => entry.tags.includes(tag)))
    }

    const total = data.length
    const offset = params.offset ?? 0
    const limit = params.limit ?? 20
    return { data: data.slice(offset, offset + limit), total }
  }

  async updateStatus(id: string, status: MemoryStatus): Promise<MemoryEntry> {
    const entry = this.requireEntry(id)
    entry.status = status
    entry.updatedAt = new Date()
    return entry
  }

  async addSource(memoryEntryId: string, source: CreateMemorySourceInput): Promise<MemorySource> {
    const entry = this.requireEntry(memoryEntryId)
    const newSource: MemorySource = {
      id: `source-${entry.sources.length + 1}`,
      memoryEntryId,
      sourceType: source.sourceType,
      sourceRef: source.sourceRef,
      sourceTitle: source.sourceTitle ?? null,
      sourceExcerpt: source.sourceExcerpt ?? null,
      createdAt: new Date()
    }
    entry.sources.push(newSource)
    return newSource
  }

  async supersede(oldEntryId: string, replacement: CreateMemoryEntryInput): Promise<MemoryEntry> {
    const oldEntry = this.requireEntry(oldEntryId)
    const newEntry = this.makeEntry({ ...replacement, supersedesId: oldEntryId })
    oldEntry.status = 'superseded'
    oldEntry.supersededById = newEntry.id
    this.entries.push(newEntry)
    return newEntry
  }

  private makeEntry(input: CreateMemoryEntryInput): MemoryEntry {
    const id = `memory-${this.entries.length + 1}`
    const now = new Date()
    return {
      id,
      type: input.type,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      status: input.status ?? 'active',
      confidence: input.confidence ?? 1,
      sources:
        input.sources?.map((source, index) => ({
          id: `source-${id}-${index}`,
          memoryEntryId: id,
          sourceType: source.sourceType,
          sourceRef: source.sourceRef,
          sourceTitle: source.sourceTitle ?? null,
          sourceExcerpt: source.sourceExcerpt ?? null,
          createdAt: now
        })) ?? [],
      supersedesId: input.supersedesId ?? null,
      supersededById: null,
      createdAt: now,
      updatedAt: now
    }
  }

  private requireEntry(id: string): MemoryEntry {
    const entry = this.entries.find((candidate) => candidate.id === id)
    if (!entry) throw new Error(`Memory entry not found: ${id}`)
    return entry
  }
}
