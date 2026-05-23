export type MemoryType =
  | 'decision'
  | 'research_note'
  | 'implementation_note'
  | 'source_summary'
  | 'open_question'

export type MemoryStatus = 'active' | 'superseded' | 'archived'

export type MemorySourceType = 'file' | 'url' | 'api' | 'user_instruction' | 'code' | 'manual'

export interface MemorySource {
  id: string
  memoryEntryId: string
  sourceType: MemorySourceType
  sourceRef: string
  sourceTitle: string | null
  sourceExcerpt: string | null
  createdAt: Date
}

export interface MemoryEntry {
  id: string
  type: MemoryType
  title: string
  body: string
  tags: string[]
  status: MemoryStatus
  confidence: number
  sources: MemorySource[]
  supersedesId: string | null
  supersededById: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MemorySearchParams {
  query?: string
  type?: MemoryType
  tags?: string[]
  status?: MemoryStatus
  limit?: number
  offset?: number
}
