import { describe, expect, it } from 'vitest'
import type { Founder, FounderSearchParams, FounderWithCompany } from '../../domain'
import type { IFounderRepository } from '../../repositories'
import { FounderService } from '../FounderService'

describe('FounderService', () => {
  it('searches founders with normalized filters and defaults', async () => {
    const founderRepository = new InMemoryFounderRepository()
    const service = new FounderService(founderRepository)

    await service.searchFounders({
      query: '  ada  ',
      company: '  acme  ',
      batch: ' W24 ',
      industry: ' Developer Tools ',
      previousEmployer: ' Stripe ',
      school: ' MIT '
    })

    expect(founderRepository.lastSearchParams).toEqual({
      query: 'ada',
      company: 'acme',
      batch: 'W24',
      industry: 'Developer Tools',
      previousEmployer: 'Stripe',
      school: 'MIT',
      limit: 20,
      offset: 0
    })
  })

  it('clamps pagination', async () => {
    const founderRepository = new InMemoryFounderRepository()
    const service = new FounderService(founderRepository)

    await service.searchFounders({ limit: 100, offset: -10 })

    expect(founderRepository.lastSearchParams).toEqual({
      limit: 50,
      offset: 0
    })
  })
})

class InMemoryFounderRepository implements IFounderRepository {
  lastSearchParams: FounderSearchParams | null = null

  async findByCompanyId(): Promise<Founder[]> {
    return []
  }

  async search(params: FounderSearchParams): Promise<{ data: FounderWithCompany[]; total: number }> {
    this.lastSearchParams = params
    return { data: [], total: 0 }
  }

  async upsertMany(): Promise<number> {
    return 0
  }
}
