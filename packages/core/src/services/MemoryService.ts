import type { MemoryEntry, MemorySearchParams, MemoryStatus } from '../domain'
import type {
  CreateMemoryEntryInput,
  CreateMemorySourceInput,
  IMemoryRepository
} from '../repositories'

export const MEMORY_SOURCE_EXCERPT_MAX_LENGTH = 500
const DEFAULT_SEARCH_LIMIT = 20
const MAX_SEARCH_LIMIT = 100

export class MemoryService {
  constructor(private readonly memoryRepository: IMemoryRepository) {}

  async addMemory(input: CreateMemoryEntryInput): Promise<MemoryEntry> {
    return this.memoryRepository.create(this.normalizeCreateInput(input))
  }

  async findById(id: string): Promise<MemoryEntry | null> {
    return this.memoryRepository.findById(id)
  }

  async searchMemory(params: MemorySearchParams = {}): Promise<{ data: MemoryEntry[]; total: number }> {
    return this.memoryRepository.search({
      ...params,
      status: params.status ?? 'active',
      limit: this.normalizeLimit(params.limit),
      offset: Math.max(params.offset ?? 0, 0)
    })
  }

  async archiveMemory(id: string): Promise<MemoryEntry> {
    return this.memoryRepository.updateStatus(id, 'archived')
  }

  async updateStatus(id: string, status: MemoryStatus): Promise<MemoryEntry> {
    return this.memoryRepository.updateStatus(id, status)
  }

  async addSource(memoryEntryId: string, source: CreateMemorySourceInput) {
    return this.memoryRepository.addSource(memoryEntryId, this.normalizeSource(source))
  }

  async supersedeMemory(oldEntryId: string, replacement: CreateMemoryEntryInput): Promise<MemoryEntry> {
    return this.memoryRepository.supersede(
      oldEntryId,
      this.normalizeCreateInput({
        ...replacement,
        status: replacement.status ?? 'active',
        supersedesId: oldEntryId
      })
    )
  }

  private normalizeCreateInput(input: CreateMemoryEntryInput): CreateMemoryEntryInput {
    const title = input.title.trim()
    const body = input.body.trim()
    if (!title) throw new Error('Memory title is required')
    if (!body) throw new Error('Memory body is required')

    const confidence = input.confidence ?? 1
    if (confidence < 0 || confidence > 1) {
      throw new Error('Memory confidence must be between 0 and 1')
    }

    return {
      ...input,
      title,
      body,
      tags: Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))).sort(),
      status: input.status ?? 'active',
      confidence,
      sources: input.sources?.map((source) => this.normalizeSource(source))
    }
  }

  private normalizeSource(source: CreateMemorySourceInput): CreateMemorySourceInput {
    return {
      ...source,
      sourceRef: source.sourceRef.trim(),
      sourceTitle: source.sourceTitle?.trim() || null,
      sourceExcerpt: source.sourceExcerpt
        ? source.sourceExcerpt.slice(0, MEMORY_SOURCE_EXCERPT_MAX_LENGTH)
        : null
    }
  }

  private normalizeLimit(limit: number | undefined): number {
    return Math.min(Math.max(limit ?? DEFAULT_SEARCH_LIMIT, 1), MAX_SEARCH_LIMIT)
  }
}
