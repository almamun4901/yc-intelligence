import type { PrismaClient } from '@prisma/client'
import type { MemoryEntry, MemorySource, MemoryStatus } from '../../domain'
import type {
  CreateMemoryEntryInput,
  CreateMemorySourceInput,
  IMemoryRepository
} from '../IMemoryRepository'

type MemoryEntryRow = Awaited<ReturnType<PrismaClient['memoryEntry']['findFirst']>>
type MemorySourceRow = Awaited<ReturnType<PrismaClient['memorySource']['findFirst']>>
type MemoryEntryWithSources = NonNullable<MemoryEntryRow> & {
  sources: NonNullable<MemorySourceRow>[]
}

export class PrismaMemoryRepository implements IMemoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMemoryEntryInput): Promise<MemoryEntry> {
    const row = await this.prisma.memoryEntry.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body,
        tags: input.tags ?? [],
        status: input.status ?? 'active',
        confidence: input.confidence ?? 1,
        supersedesId: input.supersedesId ?? null,
        sources: input.sources?.length
          ? {
              create: input.sources.map((source) => this.toSourceCreateData(source))
            }
          : undefined
      },
      include: { sources: true }
    })

    return this.toDomain(row)
  }

  async findById(id: string): Promise<MemoryEntry | null> {
    const row = await this.prisma.memoryEntry.findUnique({
      where: { id },
      include: { sources: true }
    })

    return row ? this.toDomain(row) : null
  }

  async search(params: Parameters<IMemoryRepository['search']>[0]): Promise<{
    data: MemoryEntry[]
    total: number
  }> {
    const where = {
      ...(params.query
        ? {
            OR: [
              { title: { contains: params.query, mode: 'insensitive' as const } },
              { body: { contains: params.query, mode: 'insensitive' as const } }
            ]
          }
        : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.tags?.length ? { tags: { hasEvery: params.tags } } : {})
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.memoryEntry.findMany({
        where,
        include: { sources: true },
        orderBy: { updatedAt: 'desc' },
        take: params.limit ?? 20,
        skip: params.offset ?? 0
      }),
      this.prisma.memoryEntry.count({ where })
    ])

    return { data: rows.map((row) => this.toDomain(row)), total }
  }

  async updateStatus(id: string, status: MemoryStatus): Promise<MemoryEntry> {
    const row = await this.prisma.memoryEntry.update({
      where: { id },
      data: { status },
      include: { sources: true }
    })

    return this.toDomain(row)
  }

  async addSource(memoryEntryId: string, source: CreateMemorySourceInput): Promise<MemorySource> {
    const row = await this.prisma.memorySource.create({
      data: {
        memoryEntryId,
        ...this.toSourceCreateData(source)
      }
    })

    return this.sourceToDomain(row)
  }

  async supersede(oldEntryId: string, replacement: CreateMemoryEntryInput): Promise<MemoryEntry> {
    const newEntry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.memoryEntry.create({
        data: {
          type: replacement.type,
          title: replacement.title,
          body: replacement.body,
          tags: replacement.tags ?? [],
          status: replacement.status ?? 'active',
          confidence: replacement.confidence ?? 1,
          supersedesId: oldEntryId,
          sources: replacement.sources?.length
            ? {
                create: replacement.sources.map((source) => this.toSourceCreateData(source))
              }
            : undefined
        },
        include: { sources: true }
      })

      await tx.memoryEntry.update({
        where: { id: oldEntryId },
        data: {
          status: 'superseded',
          supersededById: created.id
        }
      })

      return created
    })

    return this.toDomain(newEntry)
  }

  private toSourceCreateData(source: CreateMemorySourceInput) {
    return {
      sourceType: source.sourceType,
      sourceRef: source.sourceRef,
      sourceTitle: source.sourceTitle ?? null,
      sourceExcerpt: source.sourceExcerpt ?? null
    }
  }

  private toDomain(row: MemoryEntryWithSources): MemoryEntry {
    return {
      id: row.id,
      type: row.type as MemoryEntry['type'],
      title: row.title,
      body: row.body,
      tags: row.tags,
      status: row.status as MemoryEntry['status'],
      confidence: row.confidence,
      sources: row.sources.map((source) => this.sourceToDomain(source)),
      supersedesId: row.supersedesId,
      supersededById: row.supersededById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }

  private sourceToDomain(row: NonNullable<MemorySourceRow>): MemorySource {
    return {
      id: row.id,
      memoryEntryId: row.memoryEntryId,
      sourceType: row.sourceType as MemorySource['sourceType'],
      sourceRef: row.sourceRef,
      sourceTitle: row.sourceTitle,
      sourceExcerpt: row.sourceExcerpt,
      createdAt: row.createdAt
    }
  }
}
