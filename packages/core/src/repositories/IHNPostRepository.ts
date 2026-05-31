import type { CompanyHNSyncState, HNPost, HNPostSearchParams, HNPostType } from '../domain'

export interface UpsertHNPostInput {
  companyId: string
  hnObjectId: string
  hnItemId: string | null
  title: string
  url: string | null
  author: string | null
  points: number
  commentCount: number
  relevanceScore: number
  matchReasons: string[]
  postType: HNPostType
  postedAt: Date
  rawData?: unknown
}

export interface UpdateHNSyncStateInput {
  lastFetchedAt?: Date
  lastSuccessfulSearchAt?: Date | null
  lastSeenPostedAt?: Date | null
  failureCount?: number
  lastError?: string | null
}

export interface IHNPostRepository {
  upsertMany(posts: UpsertHNPostInput[]): Promise<number>
  search(params: HNPostSearchParams): Promise<{ data: HNPost[]; total: number }>
  getSyncState(companyId: string): Promise<CompanyHNSyncState | null>
  updateSyncState(companyId: string, input: UpdateHNSyncStateInput): Promise<CompanyHNSyncState>
}
