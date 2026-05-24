import { describe, expect, it } from 'vitest'
import type { CompanyHNSyncState, HNPost, HNPostSearchParams } from '../../domain'
import type { IHNPostRepository } from '../../repositories'
import { HNService } from '../HNService'

describe('HNService', () => {
  it('normalizes filters and defaults broad searches to signal sort', async () => {
    const repo = new InMemoryHNPostRepository()
    const service = new HNService(repo)

    await service.searchHNActivity({
      companySlug: '  acme-ai  ',
      companyName: '  Acme  ',
      batch: '  W24  ',
      industry: '  Developer Tools  ',
      minPoints: -5,
      limit: 100,
      offset: -10
    })

    expect(repo.lastSearchParams).toEqual({
      companySlug: 'acme-ai',
      companyName: 'Acme',
      batch: 'W24',
      industry: 'Developer Tools',
      minPoints: 0,
      sort: 'signal',
      limit: 50,
      offset: 0
    })
  })

  it('defaults date-bounded searches to newest sort', async () => {
    const repo = new InMemoryHNPostRepository()
    const service = new HNService(repo)
    const since = new Date('2026-05-01T00:00:00.000Z')

    await service.searchHNActivity({ since })

    expect(repo.lastSearchParams).toEqual({
      since,
      sort: 'newest',
      limit: 20,
      offset: 0
    })
  })
})

class InMemoryHNPostRepository implements IHNPostRepository {
  lastSearchParams: HNPostSearchParams | null = null

  async upsertMany(): Promise<number> {
    return 0
  }

  async search(params: HNPostSearchParams): Promise<{ data: HNPost[]; total: number }> {
    this.lastSearchParams = params
    return { data: [], total: 0 }
  }

  async getSyncState(): Promise<CompanyHNSyncState | null> {
    return null
  }

  async updateSyncState(): Promise<CompanyHNSyncState> {
    throw new Error('Not implemented')
  }
}
