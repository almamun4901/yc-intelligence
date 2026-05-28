import type { Prisma, PrismaClient } from '@prisma/client'
import type { Company, CompanySearchParams } from '../../domain'
import type { ICompanyRepository, UpsertCompanyInput } from '../ICompanyRepository'

type CompanyRow = Awaited<ReturnType<PrismaClient['company']['findFirst']>>

export class PrismaCompanyRepository implements ICompanyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Company | null> {
    const row = await this.prisma.company.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findBySlug(slug: string): Promise<Company | null> {
    const row = await this.prisma.company.findUnique({ where: { slug } })
    return row ? this.toDomain(row) : null
  }

  async search(params: CompanySearchParams): Promise<{ data: Company[]; total: number }> {
    const where = this.buildWhere(params)
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        orderBy: [{ batch: 'desc' }, { name: 'asc' }],
        take: params.limit ?? 20,
        skip: params.offset ?? 0
      }),
      this.prisma.company.count({ where })
    ])

    return { data: rows.map((row) => this.toDomain(row)), total }
  }

  async upsert(company: UpsertCompanyInput): Promise<Company> {
    const data = this.toPrismaData(company)
    const row = await this.prisma.company.upsert({
      where: { slug: company.slug },
      create: data,
      update: data
    })

    return this.toDomain(row)
  }

  async upsertMany(companies: UpsertCompanyInput[]): Promise<number> {
    let count = 0
    for (const company of companies) {
      await this.upsert(company)
      count += 1
    }
    return count
  }

  private buildWhere(params: CompanySearchParams): Prisma.CompanyWhereInput {
    return {
      ...(params.query
        ? {
            OR: [
              { name: { contains: params.query, mode: 'insensitive' } },
              { description: { contains: params.query, mode: 'insensitive' } },
              { shortDescription: { contains: params.query, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(params.batch ? { batch: params.batch } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.isHiring !== undefined ? { isHiring: params.isHiring } : {}),
      ...(params.industry ? { tags: { has: params.industry } } : {}),
      ...(params.location ? { location: { contains: params.location, mode: 'insensitive' } } : {})
    }
  }

  private toPrismaData(company: UpsertCompanyInput): Prisma.CompanyUncheckedCreateInput {
    return {
      name: company.name,
      slug: company.slug,
      batch: company.batch,
      status: company.status,
      description: company.description,
      shortDescription: company.shortDescription,
      website: company.website,
      teamSize: company.teamSize,
      isHiring: company.isHiring,
      tags: company.tags,
      location: company.location,
      rawData: company.rawData as Prisma.InputJsonValue | undefined
    }
  }

  private toDomain(row: NonNullable<CompanyRow>): Company {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      batch: row.batch,
      status: row.status as Company['status'],
      description: row.description,
      shortDescription: row.shortDescription,
      website: row.website,
      teamSize: row.teamSize as Company['teamSize'],
      isHiring: row.isHiring,
      tags: row.tags,
      location: row.location,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }
}
