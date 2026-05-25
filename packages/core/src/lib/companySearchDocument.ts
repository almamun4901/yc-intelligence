import { createHash } from 'crypto'
import type { Company, HNPost, Job } from '../domain'

export interface CompanySearchDocumentInput {
  company: Company
  jobs?: Job[]
  hnPosts?: HNPost[]
}

export const buildCompanySearchDocument = ({ company, jobs = [], hnPosts = [] }: CompanySearchDocumentInput): string => {
  const lines = [
    line('Name', company.name),
    line('Batch', company.batch),
    line('Status', company.status),
    line('Tags', company.tags.join(', ')),
    line('Short description', company.shortDescription),
    line('Description', company.description),
    line('Location', company.location),
    line('Hiring', company.isHiring ? 'yes' : 'no')
  ]

  const activeJobs = jobs
    .filter((job) => job.isActive)
    .sort((a, b) => sortNullableDateDesc(a.postedAt, b.postedAt) || a.title.localeCompare(b.title))
    .slice(0, 5)
    .map((job) => compact([job.title, job.location, job.techStack.join(', ')]))

  if (activeJobs.length > 0) {
    lines.push(line('Recent jobs', activeJobs.join(' | ')))
  }

  const recentHNPosts = hnPosts
    .slice()
    .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
    .slice(0, 5)
    .map((post) => compact([post.postType, post.title]))

  if (recentHNPosts.length > 0) {
    lines.push(line('Recent Hacker News', recentHNPosts.join(' | ')))
  }

  return lines.filter(Boolean).join('\n')
}

export const hashCompanySearchDocument = (sourceText: string): string =>
  createHash('sha256').update(sourceText).digest('hex')

const line = (label: string, value: string | null | undefined): string => {
  const normalized = value?.trim()
  return normalized ? `${label}: ${normalized}` : ''
}

const compact = (values: Array<string | null | undefined>): string =>
  values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(' - ')

const sortNullableDateDesc = (left: Date | null, right: Date | null): number => {
  if (left && right) return right.getTime() - left.getTime()
  if (left) return -1
  if (right) return 1
  return 0
}
