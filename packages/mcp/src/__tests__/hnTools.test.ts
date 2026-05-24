import { describe, expect, it } from 'vitest'
import type { HNPost } from '@yc-intelligence/core'
import { z } from 'zod'
import { getHNActivityInputSchema, handleGetHNActivity } from '../hnTools'

describe('HN MCP tools', () => {
  it('accepts expected HN activity inputs', () => {
    const parsed = z.object(getHNActivityInputSchema).parse({
      companySlug: 'acme-ai',
      batch: 'W24',
      industry: 'Developer Tools',
      postType: 'Show HN',
      since: '2026-05-01T00:00:00.000Z',
      minPoints: 10,
      limit: 5,
      offset: 0
    })

    expect(parsed).toEqual({
      companySlug: 'acme-ai',
      batch: 'W24',
      industry: 'Developer Tools',
      postType: 'Show HN',
      since: '2026-05-01T00:00:00.000Z',
      minPoints: 10,
      limit: 5,
      offset: 0
    })
  })

  it('formats HN activity as concise JSON text', async () => {
    const service = {
      searchHNActivity: async () => ({ data: [makeHNPost()], total: 1 })
    }

    const result = await handleGetHNActivity({ companySlug: 'acme-ai' }, service)
    const payload = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')

    expect(payload).toEqual({
      total: 1,
      count: 1,
      posts: [
        {
          company: {
            name: 'Acme AI',
            slug: 'acme-ai',
            batch: 'W24'
          },
          title: 'Show HN: Acme AI',
          url: 'https://news.ycombinator.com/item?id=100',
          author: 'ada',
          points: 42,
          comments: 7,
          postType: 'Show HN',
          postedAt: '2026-05-01T00:00:00.000Z'
        }
      ]
    })
  })
})

function makeHNPost(overrides: Partial<HNPost> = {}): HNPost {
  return {
    id: 'hn-1',
    companyId: 'company-1',
    company: {
      id: 'company-1',
      name: 'Acme AI',
      slug: 'acme-ai',
      batch: 'W24',
      tags: ['Developer Tools']
    },
    hnObjectId: '100',
    hnItemId: '100',
    title: 'Show HN: Acme AI',
    url: 'https://news.ycombinator.com/item?id=100',
    author: 'ada',
    points: 42,
    commentCount: 7,
    postType: 'Show HN',
    postedAt: new Date('2026-05-01T00:00:00.000Z'),
    fetchedAt: new Date('2026-05-24T00:00:00.000Z'),
    ...overrides
  }
}
