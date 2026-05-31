export type HNPostType = 'Show HN' | 'Ask HN' | 'Launch' | 'Hiring' | 'Other'

export interface HNPost {
  id: string
  companyId: string
  company?: {
    id: string
    name: string
    slug: string
    batch: string | null
    tags: string[]
  }
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
  fetchedAt: Date
  rawData?: unknown
}

export interface CompanyHNSyncState {
  id: string
  companyId: string
  lastFetchedAt: Date | null
  lastSuccessfulSearchAt: Date | null
  lastSeenPostedAt: Date | null
  failureCount: number
  lastError: string | null
  updatedAt: Date
}

export interface HNPostSearchParams {
  companyId?: string
  companySlug?: string
  companyName?: string
  batch?: string
  industry?: string
  postType?: HNPostType
  since?: Date
  until?: Date
  minPoints?: number
  minRelevanceScore?: number
  limit?: number
  offset?: number
  sort?: 'signal' | 'newest'
}
