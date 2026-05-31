import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type {
  CreateMemoryEntryInput,
  MemorySearchParams,
  MemoryService
} from '@yc-intelligence/core'
import { z } from 'zod'
import type { ToolServer } from './companyTools'

export type MemoryToolService = Pick<MemoryService, 'addMemory' | 'searchMemory' | 'supersedeMemory'>

export const memoryTypeSchema = z.enum([
  'decision',
  'research_note',
  'implementation_note',
  'source_summary',
  'open_question'
])

export const memoryStatusSchema = z.enum(['active', 'superseded', 'archived'])

export const memorySourceTypeSchema = z.enum(['file', 'url', 'api', 'user_instruction', 'code', 'manual'])

export const memorySourceInputSchema = z.object({
  sourceType: memorySourceTypeSchema,
  sourceRef: z.string().min(1),
  sourceTitle: z.string().optional(),
  sourceExcerpt: z.string().optional()
})

export const addMemoryInputSchema = {
  type: memoryTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()).optional(),
  status: memoryStatusSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  sources: z.array(memorySourceInputSchema).optional()
}

export const searchMemoryInputSchema = {
  query: z.string().optional(),
  type: memoryTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  status: memoryStatusSchema.optional(),
  limit: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional()
}

export const supersedeMemoryInputSchema = {
  oldEntryId: z.string().min(1),
  type: memoryTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sources: z.array(memorySourceInputSchema).optional()
}

type SupersedeMemoryInput = CreateMemoryEntryInput & {
  oldEntryId: string
}

export const registerMemoryTools = (server: ToolServer, memoryService: MemoryToolService) => {
  server.registerTool(
    'add_memory',
    {
      title: 'Add project memory',
      description: 'Add a project-level decision, research note, implementation note, source summary, or open question.',
      inputSchema: addMemoryInputSchema
    },
    async (input: CreateMemoryEntryInput) => handleAddMemory(input, memoryService)
  )

  server.registerTool(
    'search_memory',
    {
      title: 'Search project memory',
      description: 'Search project memory entries by query, type, tags, status, limit, and offset.',
      inputSchema: searchMemoryInputSchema
    },
    async (input: MemorySearchParams) => handleSearchMemory(input, memoryService)
  )

  server.registerTool(
    'supersede_memory',
    {
      title: 'Supersede project memory',
      description: 'Replace an old project memory entry with a new active entry and mark the old entry superseded.',
      inputSchema: supersedeMemoryInputSchema
    },
    async (input: SupersedeMemoryInput) => handleSupersedeMemory(input, memoryService)
  )
}

export const handleAddMemory = async (
  input: CreateMemoryEntryInput,
  memoryService: MemoryToolService
): Promise<CallToolResult> => {
  const memory = await memoryService.addMemory(input)

  return jsonResult({
    memory: formatMemory(memory)
  })
}

export const handleSearchMemory = async (
  input: MemorySearchParams,
  memoryService: MemoryToolService
): Promise<CallToolResult> => {
  const result = await memoryService.searchMemory(input)

  return jsonResult({
    total: result.total,
    count: result.data.length,
    memories: result.data.map(formatMemory)
  })
}

export const handleSupersedeMemory = async (
  input: SupersedeMemoryInput,
  memoryService: MemoryToolService
): Promise<CallToolResult> => {
  const { oldEntryId, ...replacement } = input
  const memory = await memoryService.supersedeMemory(oldEntryId, replacement)

  return jsonResult({
    memory: formatMemory(memory)
  })
}

const formatMemory = (memory: Awaited<ReturnType<MemoryToolService['addMemory']>>) => ({
  id: memory.id,
  type: memory.type,
  title: memory.title,
  body: memory.body,
  tags: memory.tags,
  status: memory.status,
  confidence: memory.confidence,
  supersedesId: memory.supersedesId,
  supersededById: memory.supersededById,
  sources: memory.sources.map((source) => ({
    sourceType: source.sourceType,
    sourceRef: source.sourceRef,
    sourceTitle: source.sourceTitle,
    sourceExcerpt: source.sourceExcerpt
  })),
  createdAt: memory.createdAt.toISOString(),
  updatedAt: memory.updatedAt.toISOString()
})

const jsonResult = (value: unknown): CallToolResult => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(value, null, 2)
    }
  ]
})
