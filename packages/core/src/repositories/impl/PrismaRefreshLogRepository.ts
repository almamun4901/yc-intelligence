import type { PrismaClient } from '@prisma/client'
import type {
  CompleteRefreshLogInput,
  FailRefreshLogInput,
  IRefreshLogRepository,
  RefreshLogEntry
} from '../IRefreshLogRepository'

type RefreshLogRow = Awaited<ReturnType<PrismaClient['refreshLog']['findFirst']>>

export class PrismaRefreshLogRepository implements IRefreshLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async start(source: string): Promise<RefreshLogEntry> {
    const row = await this.prisma.refreshLog.create({
      data: {
        source,
        startedAt: new Date(),
        status: 'running'
      }
    })

    return this.toDomain(row)
  }

  async complete(id: string, input: CompleteRefreshLogInput = {}): Promise<RefreshLogEntry> {
    const row = await this.prisma.refreshLog.update({
      where: { id },
      data: {
        completedAt: new Date(),
        recordCount: input.recordCount ?? 0,
        errorCount: input.errorCount ?? 0,
        status: 'success',
        errorMsg: null
      }
    })

    return this.toDomain(row)
  }

  async fail(id: string, input: FailRefreshLogInput): Promise<RefreshLogEntry> {
    const row = await this.prisma.refreshLog.update({
      where: { id },
      data: {
        completedAt: new Date(),
        recordCount: input.recordCount ?? 0,
        errorCount: input.errorCount ?? 1,
        status: 'failed',
        errorMsg: input.errorMsg
      }
    })

    return this.toDomain(row)
  }

  private toDomain(row: NonNullable<RefreshLogRow>): RefreshLogEntry {
    return {
      id: row.id,
      source: row.source,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      recordCount: row.recordCount,
      errorCount: row.errorCount,
      status: row.status as RefreshLogEntry['status'],
      errorMsg: row.errorMsg
    }
  }
}
