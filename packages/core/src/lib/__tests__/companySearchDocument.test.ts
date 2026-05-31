import { describe, expect, it } from 'vitest'
import type { Company, HNPost, Job } from '../../domain'
import { buildCompanySearchDocument, hashCompanySearchDocument } from '../companySearchDocument'

describe('companySearchDocument', () => {
  it('builds deterministic company text from company, job, and HN signals', () => {
    const document = buildCompanySearchDocument({
      company: makeCompany(),
      jobs: [
        makeJob({ title: 'Frontend Engineer', postedAt: new Date('2026-04-01T00:00:00.000Z') }),
        makeJob({ title: 'Backend Engineer', postedAt: new Date('2026-05-01T00:00:00.000Z') }),
        makeJob({ title: 'Inactive Engineer', isActive: false })
      ],
      hnPosts: [
        makeHNPost({ title: 'Older launch', postedAt: new Date('2026-03-01T00:00:00.000Z') }),
        makeHNPost({ title: 'New launch', postedAt: new Date('2026-05-01T00:00:00.000Z') })
      ]
    })

    expect(document).toContain('Name: Acme AI')
    expect(document).toContain('Tags: Developer Tools, AI')
    expect(document).toContain('Recent jobs: Backend Engineer - Remote - rust, postgresql | Frontend Engineer - Remote - rust, postgresql')
    expect(document).toContain('Recent Hacker News: Show HN - New launch | Show HN - Older launch')
    expect(document).not.toContain('Inactive Engineer')
  })

  it('hashes document text consistently', () => {
    const document = buildCompanySearchDocument({ company: makeCompany() })

    expect(hashCompanySearchDocument(document)).toBe(hashCompanySearchDocument(document))
    expect(hashCompanySearchDocument(document)).toHaveLength(64)
  })
})

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    name: 'Acme AI',
    slug: 'acme-ai',
    batch: 'W24',
    status: 'Active',
    description: 'Builds AI infrastructure for developers.',
    shortDescription: 'AI developer infrastructure',
    website: 'https://acme.example',
    teamSize: '1-10',
    isHiring: true,
    tags: ['Developer Tools', 'AI'],
    location: 'Remote',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides
  }
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    companyId: 'company-1',
    title: 'Backend Engineer',
    location: 'Remote',
    isRemote: true,
    description: 'Rust and Postgres',
    techStack: ['rust', 'postgresql'],
    atsSource: 'greenhouse',
    applyUrl: 'https://example.com/jobs/1',
    isActive: true,
    postedAt: new Date('2026-05-01T00:00:00.000Z'),
    fetchedAt: new Date('2026-05-23T00:00:00.000Z'),
    ...overrides
  }
}

function makeHNPost(overrides: Partial<HNPost> = {}): HNPost {
  return {
    id: 'hn-1',
    companyId: 'company-1',
    hnObjectId: '123',
    hnItemId: '123',
    title: 'Show HN: Acme',
    url: 'https://news.ycombinator.com/item?id=123',
    author: 'founder',
    points: 10,
    commentCount: 2,
    relevanceScore: 100,
    matchReasons: ['domain:acme.ai'],
    postType: 'Show HN',
    postedAt: new Date('2026-05-01T00:00:00.000Z'),
    fetchedAt: new Date('2026-05-23T00:00:00.000Z'),
    rawData: null,
    ...overrides
  }
}
