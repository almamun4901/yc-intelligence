import type { Prisma, PrismaClient } from '@prisma/client'
import type { Founder, FounderSearchParams, FounderWithCompany } from '../../domain'
import type { IFounderRepository, UpsertFounderInput } from '../IFounderRepository'

type FounderRow = Awaited<ReturnType<PrismaClient['founder']['findFirst']>>
type FounderWithCompanyRow = Prisma.FounderGetPayload<{ include: { company: true } }>

export class PrismaFounderRepository implements IFounderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCompanyId(companyId: string): Promise<Founder[]> {
    const rows = await this.prisma.founder.findMany({
      where: { companyId },
      orderBy: { name: 'asc' }
    })

    return rows.map((row) => this.toDomain(row))
  }

  async search(params: FounderSearchParams): Promise<{ data: FounderWithCompany[]; total: number }> {
    const where = this.buildWhere(params)
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.founder.findMany({
        where,
        include: { company: true },
        orderBy: [{ company: { batch: 'desc' } }, { name: 'asc' }],
        take: params.limit ?? 20,
        skip: params.offset ?? 0
      }),
      this.prisma.founder.count({ where })
    ])

    return { data: rows.map((row) => this.toDomainWithCompany(row)), total }
  }

  async upsertMany(founders: UpsertFounderInput[]): Promise<number> {
    let count = 0
    for (const founder of founders) {
      await this.prisma.founder.upsert({
        where: {
          companyId_name: {
            companyId: founder.companyId,
            name: founder.name
          }
        },
        create: {
          companyId: founder.companyId,
          name: founder.name,
          linkedinUrl: founder.linkedinUrl,
          previousEmployers: founder.previousEmployers ?? [],
          schools: founder.schools ?? []
        },
        update: {
          linkedinUrl: founder.linkedinUrl,
          previousEmployers: founder.previousEmployers ?? [],
          schools: founder.schools ?? []
        }
      })
      count += 1
    }
    return count
  }

  private toDomain(row: NonNullable<FounderRow>): Founder {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      linkedinUrl: row.linkedinUrl,
      previousEmployers: row.previousEmployers,
      schools: row.schools,
      createdAt: row.createdAt
    }
  }

  private buildWhere(params: FounderSearchParams): Prisma.FounderWhereInput {
    const companyFilters: Prisma.CompanyWhereInput[] = [
      ...(params.company ? [{ name: { contains: params.company, mode: 'insensitive' as const } }] : []),
      ...(params.batch ? [{ batch: params.batch }] : []),
      ...(params.industry ? [{ tags: { has: params.industry } }] : [])
    ]

    return {
      ...(params.query
        ? {
            OR: [
              { name: { contains: params.query, mode: 'insensitive' } },
              { company: { name: { contains: params.query, mode: 'insensitive' } } },
              { company: { shortDescription: { contains: params.query, mode: 'insensitive' } } },
              { previousEmployers: { has: params.query } },
              { schools: { has: params.query } }
            ]
          }
        : {}),
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.previousEmployer ? { previousEmployers: { has: params.previousEmployer } } : {}),
      ...(params.school ? { schools: { has: params.school } } : {}),
      ...(companyFilters.length ? { company: { AND: companyFilters } } : {})
    }
  }

  private toDomainWithCompany(row: FounderWithCompanyRow): FounderWithCompany {
    return {
      ...this.toDomain(row),
      company: {
        id: row.company.id,
        name: row.company.name,
        slug: row.company.slug,
        batch: row.company.batch,
        status: row.company.status,
        shortDescription: row.company.shortDescription,
        website: row.company.website,
        isHiring: row.company.isHiring,
        tags: row.company.tags,
        location: row.company.location
      }
    }
  }
}
