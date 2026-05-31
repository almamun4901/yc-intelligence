import { describe, expect, it } from 'vitest'
import type { HNPost, HNPostSearchParams } from '@yc-intelligence/core'
import { buildServer } from '../index'
import type { ApiLogger } from '../cache'

describe('API HN activity routes', () => {
  it('searches HN activity with supported filters', async () => {
    const service = new TestHNActivityService()
    service.searchResult = { data: [makeHNPost()], total: 1 }
    const app = buildServer({ hnService: service, logger: testLogger })

    const response = await app.inject({
      method: 'GET',
      url:
        '/hn-activity?companySlug=acme-ai&companyName=Acme&batch=W24&industry=Developer%20Tools&postType=Show%20HN&since=2026-05-01T00%3A00%3A00.000Z&until=2026-05-31T00%3A00%3A00.000Z&minPoints=25&minRelevanceScore=80&limit=10&offset=5&sort=newest'
    })

    expect(response.statusCode).toBe(200)
    expect(service.lastSearchParams).toEqual({
      companySlug: 'acme-ai',
      companyName: 'Acme',
      batch: 'W24',
      industry: 'Developer Tools',
      postType: 'Show HN',
      since: new Date('2026-05-01T00:00:00.000Z'),
      until: new Date('2026-05-31T00:00:00.000Z'),
      minPoints: 25,
      minRelevanceScore: 80,
      limit: 10,
      offset: 5,
      sort: 'newest'
    })
    expect(response.json()).toEqual({
      total: 1,
      count: 1,
      posts: [
        {
          id: 'hn-post-1',
          companyId: 'company-1',
          company: {
            id: 'company-1',
            name: 'Acme AI',
            slug: 'acme-ai',
            batch: 'W24',
            tags: ['Developer Tools']
          },
          hnObjectId: '123',
          hnItemId: '123',
          title: 'Show HN: Acme AI',
          url: 'https://news.ycombinator.com/item?id=123',
          author: 'dang',
          points: 42,
          comments: 12,
          relevanceScore: 195,
          matchReasons: ['domain:acme.ai', 'launch-title:acme ai'],
          postType: 'Show HN',
          postedAt: '2026-05-20T00:00:00.000Z',
          fetchedAt: '2026-05-23T00:00:00.000Z'
        }
      ]
    })
  })

  it('returns empty HN activity results', async () => {
    const app = buildServer({ hnService: new TestHNActivityService(), logger: testLogger })

    const response = await app.inject({ method: 'GET', url: '/hn-activity?postType=Hiring' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ total: 0, count: 0, posts: [] })
  })

  it('rejects invalid HN activity filters', async () => {
    const app = buildServer({ hnService: new TestHNActivityService(), logger: testLogger })

    const invalidPostType = await app.inject({ method: 'GET', url: '/hn-activity?postType=Launches' })
    const invalidLimit = await app.inject({ method: 'GET', url: '/hn-activity?limit=-1' })
    const invalidSince = await app.inject({ method: 'GET', url: '/hn-activity?since=2026-05-01' })

    expect(invalidPostType.statusCode).toBe(400)
    expect(invalidLimit.statusCode).toBe(400)
    expect(invalidSince.statusCode).toBe(400)
  })
})

class TestHNActivityService {
  searchResult: { data: HNPost[]; total: number } = { data: [], total: 0 }
  lastSearchParams: HNPostSearchParams | null = null

  async searchHNActivity(params: HNPostSearchParams): Promise<{ data: HNPost[]; total: number }> {
    this.lastSearchParams = params
    return this.searchResult
  }
}

const testLogger: ApiLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
}

function makeHNPost(overrides: Partial<HNPost> = {}): HNPost {
  return {
    id: 'hn-post-1',
    companyId: 'company-1',
    company: {
      id: 'company-1',
      name: 'Acme AI',
      slug: 'acme-ai',
      batch: 'W24',
      tags: ['Developer Tools']
    },
    hnObjectId: '123',
    hnItemId: '123',
    title: 'Show HN: Acme AI',
    url: 'https://news.ycombinator.com/item?id=123',
    author: 'dang',
    points: 42,
    commentCount: 12,
    relevanceScore: 195,
    matchReasons: ['domain:acme.ai', 'launch-title:acme ai'],
    postType: 'Show HN',
    postedAt: new Date('2026-05-20T00:00:00.000Z'),
    fetchedAt: new Date('2026-05-23T00:00:00.000Z'),
    rawData: { objectID: '123' },
    ...overrides
  }
}
