import type {
  MemoryEntry,
  MemorySearchParams,
  MemorySource,
  MemorySourceType,
  MemoryStatus,
  MemoryType
} from '../domain'

export interface CreateMemorySourceInput {
  sourceType: MemorySourceType
  sourceRef: string
  sourceTitle?: string | null
  sourceExcerpt?: string | null
}

export interface CreateMemoryEntryInput {
  type: MemoryType
  title: string
  body: string
  tags?: string[]
  status?: MemoryStatus
  confidence?: number
  sources?: CreateMemorySourceInput[]
  supersedesId?: string | null
}

export interface IMemoryRepository {
  create(input: CreateMemoryEntryInput): Promise<MemoryEntry>
  findById(id: string): Promise<MemoryEntry | null>
  search(params: MemorySearchParams): Promise<{ data: MemoryEntry[]; total: number }>
  updateStatus(id: string, status: MemoryStatus): Promise<MemoryEntry>
  addSource(memoryEntryId: string, source: CreateMemorySourceInput): Promise<MemorySource>
  supersede(oldEntryId: string, replacement: CreateMemoryEntryInput): Promise<MemoryEntry>
}
