import { describe, expect, it } from 'vitest'
import type { MemoryEntry } from '@yc-intelligence/core'
import { z } from 'zod'
import {
  addMemoryInputSchema,
  handleAddMemory,
  handleSearchMemory,
  handleSupersedeMemory,
  searchMemoryInputSchema,
  supersedeMemoryInputSchema
} from '../memoryTools'

describe('memory MCP tools', () => {
  it('accepts expected add memory inputs', () => {
    const parsed = z.object(addMemoryInputSchema).parse({
      type: 'implementation_note',
      title: 'MCP memory tools',
      body: 'Register add/search/supersede memory tools.',
      tags: ['mcp', 'memory'],
      confidence: 0.95,
      sources: [
        {
          sourceType: 'file',
          sourceRef: 'packages/mcp/src/memoryTools.ts',
          sourceTitle: 'MCP memory adapter',
          sourceExcerpt: 'Thin adapter over MemoryService'
        }
      ]
    })

    expect(parsed).toEqual({
      type: 'implementation_note',
      title: 'MCP memory tools',
      body: 'Register add/search/supersede memory tools.',
      tags: ['mcp', 'memory'],
      confidence: 0.95,
      sources: [
        {
          sourceType: 'file',
          sourceRef: 'packages/mcp/src/memoryTools.ts',
          sourceTitle: 'MCP memory adapter',
          sourceExcerpt: 'Thin adapter over MemoryService'
        }
      ]
    })
  })

  it('accepts expected search memory inputs', () => {
    const parsed = z.object(searchMemoryInputSchema).parse({
      query: 'adapter',
      type: 'implementation_note',
      tags: ['mcp'],
      status: 'active',
      limit: 10,
      offset: 5
    })

    expect(parsed).toEqual({
      query: 'adapter',
      type: 'implementation_note',
      tags: ['mcp'],
      status: 'active',
      limit: 10,
      offset: 5
    })
  })

  it('accepts expected supersede memory inputs', () => {
    const parsed = z.object(supersedeMemoryInputSchema).parse({
      oldEntryId: 'memory-1',
      type: 'decision',
      title: 'Use MCP memory tools',
      body: 'Expose project memory through the MCP server.',
      tags: ['mcp'],
      confidence: 1
    })

    expect(parsed).toEqual({
      oldEntryId: 'memory-1',
      type: 'decision',
      title: 'Use MCP memory tools',
      body: 'Expose project memory through the MCP server.',
      tags: ['mcp'],
      confidence: 1
    })
  })

  it('formats added memory as JSON text', async () => {
    const service = {
      addMemory: async () => makeMemoryEntry(),
      searchMemory: async () => ({ data: [], total: 0 }),
      supersedeMemory: async () => makeMemoryEntry()
    }

    const result = await handleAddMemory(
      {
        type: 'implementation_note',
        title: 'MCP memory tools',
        body: 'Register add/search/supersede memory tools.'
      },
      service
    )
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(payload.memory).toMatchObject({
      id: 'memory-1',
      type: 'implementation_note',
      title: 'MCP memory tools',
      tags: ['mcp', 'memory'],
      status: 'active',
      confidence: 0.95,
      supersedesId: null,
      supersededById: null,
      sources: [
        {
          sourceType: 'file',
          sourceRef: 'packages/mcp/src/memoryTools.ts',
          sourceTitle: 'MCP memory adapter',
          sourceExcerpt: 'Thin adapter over MemoryService'
        }
      ],
      createdAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T00:00:00.000Z'
    })
  })

  it('passes search filters through and formats results', async () => {
    let searchParams = null as unknown
    const service = {
      addMemory: async () => makeMemoryEntry(),
      searchMemory: async (params: unknown) => {
        searchParams = params
        return { data: [makeMemoryEntry()], total: 1 }
      },
      supersedeMemory: async () => makeMemoryEntry()
    }

    const result = await handleSearchMemory({ query: 'adapter', tags: ['mcp'], limit: 5 }, service)
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(searchParams).toEqual({ query: 'adapter', tags: ['mcp'], limit: 5 })
    expect(payload.total).toBe(1)
    expect(payload.count).toBe(1)
    expect(payload.memories[0]).toMatchObject({
      id: 'memory-1',
      title: 'MCP memory tools'
    })
  })

  it('passes supersede input through with replacement fields', async () => {
    let oldEntryId = ''
    let replacement = null as unknown
    const service = {
      addMemory: async () => makeMemoryEntry(),
      searchMemory: async () => ({ data: [], total: 0 }),
      supersedeMemory: async (id: string, input: unknown) => {
        oldEntryId = id
        replacement = input
        return makeMemoryEntry({
          id: 'memory-2',
          title: 'Updated memory',
          supersedesId: 'memory-1'
        })
      }
    }

    const result = await handleSupersedeMemory(
      {
        oldEntryId: 'memory-1',
        type: 'decision',
        title: 'Updated memory',
        body: 'Expose memory through MCP.',
        tags: ['mcp']
      },
      service
    )
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(oldEntryId).toBe('memory-1')
    expect(replacement).toEqual({
      type: 'decision',
      title: 'Updated memory',
      body: 'Expose memory through MCP.',
      tags: ['mcp']
    })
    expect(payload.memory).toMatchObject({
      id: 'memory-2',
      title: 'Updated memory',
      supersedesId: 'memory-1'
    })
  })
})

function makeMemoryEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  const now = new Date('2026-05-31T00:00:00.000Z')
  return {
    id: 'memory-1',
    type: 'implementation_note',
    title: 'MCP memory tools',
    body: 'Register add/search/supersede memory tools.',
    tags: ['mcp', 'memory'],
    status: 'active',
    confidence: 0.95,
    sources: [
      {
        id: 'source-1',
        memoryEntryId: 'memory-1',
        sourceType: 'file',
        sourceRef: 'packages/mcp/src/memoryTools.ts',
        sourceTitle: 'MCP memory adapter',
        sourceExcerpt: 'Thin adapter over MemoryService',
        createdAt: now
      }
    ],
    supersedesId: null,
    supersededById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}
