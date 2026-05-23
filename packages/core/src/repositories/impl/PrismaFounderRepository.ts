import type { PrismaClient } from '@prisma/client'
import type { Founder } from '../../domain'
import type { IFounderRepository, UpsertFounderInput } from '../IFounderRepository'

type FounderRow = Awaited<ReturnType<PrismaClient['founder']['findFirst']>>

export class PrismaFounderRepository implements IFounderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCompanyId(companyId: string): Promise<Founder[]> {
    const rows = await this.prisma.founder.findMany({
      where: { companyId },
      orderBy: { name: 'asc' }
    })

    return rows.map((row) => this.toDomain(row))
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
}
