export type RefreshLogStatus = 'running' | 'success' | 'failed'

export interface RefreshLogEntry {
  id: string
  source: string
  startedAt: Date
  completedAt: Date | null
  recordCount: number
  errorCount: number
  status: RefreshLogStatus
  errorMsg: string | null
}

export interface CompleteRefreshLogInput {
  recordCount?: number
  errorCount?: number
}

export interface FailRefreshLogInput {
  recordCount?: number
  errorCount?: number
  errorMsg: string
}

export interface IRefreshLogRepository {
  start(source: string): Promise<RefreshLogEntry>
  complete(id: string, input?: CompleteRefreshLogInput): Promise<RefreshLogEntry>
  fail(id: string, input: FailRefreshLogInput): Promise<RefreshLogEntry>
}
