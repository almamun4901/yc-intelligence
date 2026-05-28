import type { CompanyStatus, TeamSize } from '../../domain'
import type { UpsertCompanyInput } from '../../repositories'
import type { UpsertFounderInput } from '../../repositories/IFounderRepository'

export interface RawYCCompany {
  [key: string]: unknown
}

export class YCTransformer {
  toCompany(raw: RawYCCompany): UpsertCompanyInput {
    const name = normalizeString(raw.name) ?? normalizeString(raw.company_name)
    const slug = normalizeString(raw.slug) ?? slugify(name ?? '')

    if (!name) {
      throw new Error('YC company is missing a name')
    }

    if (!slug) {
      throw new Error(`YC company "${name}" is missing a slug`)
    }

    return {
      name,
      slug,
      batch: normalizeString(raw.batch),
      status: normalizeStatus(normalizeString(raw.status)),
      description:
        normalizeString(raw.longDescription) ??
        normalizeString(raw.long_description) ??
        normalizeString(raw.description),
      shortDescription:
        normalizeString(raw.oneLiner) ??
        normalizeString(raw.one_liner) ??
        normalizeString(raw.short_description),
      website: normalizeString(raw.website) ?? normalizeString(raw.website_url),
      teamSize: normalizeTeamSize(raw.teamSize ?? raw.team_size),
      isHiring:
        normalizeBoolean(raw.is_hiring) ?? normalizeBoolean(raw.isHiring) ?? includesString(raw.badges, 'isHiring'),
      tags: mergeStringArrays(raw.tags, raw.industries),
      location: firstString(raw.locations) ?? normalizeString(raw.location),
      rawData: raw
    }
  }

  toFounders(raw: RawYCCompany, companyId: string): UpsertFounderInput[] {
    const founders = Array.isArray(raw.founders) ? raw.founders : []
    const byName = new Map<string, UpsertFounderInput>()

    for (const founder of founders) {
      if (!isRecord(founder)) continue

      const name =
        normalizeString(founder.full_name) ??
        normalizeString(founder.name) ??
        normalizeString(founder.first_name)
      if (!name) continue

      byName.set(name, {
        companyId,
        name,
        linkedinUrl:
          normalizeString(founder.linkedin_url) ?? normalizeString(founder.linkedinUrl) ?? null,
        previousEmployers: [],
        schools: []
      })
    }

    return Array.from(byName.values())
  }
}

function normalizeStatus(raw: string | null): CompanyStatus {
  const normalized = raw?.trim().toLowerCase()
  if (normalized === 'acquired') return 'Acquired'
  if (normalized === 'inactive') return 'Inactive'
  if (normalized === 'dead') return 'Dead'
  return 'Active'
}

function normalizeTeamSize(raw: unknown): TeamSize | null {
  if (typeof raw === 'number') {
    if (raw <= 10) return '1-10'
    if (raw <= 50) return '11-50'
    if (raw <= 200) return '51-200'
    if (raw <= 500) return '201-500'
    return '500+'
  }

  const value = normalizeString(raw)
  if (!value) return null

  const canonical = value.replace(/\s+/g, '')
  if (canonical === '1-10') return '1-10'
  if (canonical === '11-50') return '11-50'
  if (canonical === '51-200') return '51-200'
  if (canonical === '201-500') return '201-500'
  if (canonical === '500+' || canonical === '501+') return '500+'

  const match = canonical.match(/^\d+/)
  return match ? normalizeTeamSize(Number(match[0])) : null
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => normalizeString(item))
        .filter((item): item is string => item !== null)
    )
  )
}

function mergeStringArrays(...values: unknown[]): string[] {
  return Array.from(new Set(values.flatMap((value) => normalizeStringArray(value))))
}

function includesString(value: unknown, needle: string): boolean {
  if (!Array.isArray(value)) return false
  return value.some((item) => normalizeString(item) === needle)
}

function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) return null

  for (const item of value) {
    const normalized = normalizeString(item)
    if (normalized) return normalized
  }

  return null
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes'].includes(normalized)) return true
  if (['false', '0', 'no'].includes(normalized)) return false
  return null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
