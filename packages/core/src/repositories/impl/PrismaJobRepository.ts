import type { Prisma, PrismaClient } from '@prisma/client'
import type { ATSSource, CompanyJobSyncState, Job, JobSearchParams, JobSyncStatus } from '../../domain'
import type { IJobRepository, UpdateJobSyncStateInput, UpsertJobInput } from '../IJobRepository'

type JobRow = Awaited<ReturnType<PrismaClient['job']['findFirst']>>
type JobSyncStateRow = Awaited<ReturnType<PrismaClient['companyJobSyncState']['findFirst']>>

export class PrismaJobRepository implements IJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Job | null> {
    const row = await this.prisma.job.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }

  async findByCompanyId(companyId: string): Promise<Job[]> {
    const rows = await this.prisma.job.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { postedAt: 'desc' }, { title: 'asc' }]
    })
    return rows.map((row) => this.toDomain(row))
  }

  async search(params: JobSearchParams): Promise<{ data: Job[]; total: number }> {
    const where = this.buildWhere(params)
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        orderBy: [{ postedAt: 'desc' }, { fetchedAt: 'desc' }, { title: 'asc' }],
        take: params.limit ?? 20,
        skip: params.offset ?? 0
      }),
      this.prisma.job.count({ where })
    ])

    return { data: rows.map((row) => this.toDomain(row)), total }
  }

  async upsertMany(jobs: UpsertJobInput[]): Promise<number> {
    let count = 0
    for (const job of jobs) {
      await this.prisma.job.upsert({
        where: { applyUrl: job.applyUrl },
        create: this.toPrismaData(job),
        update: this.toPrismaData(job)
      })
      count += 1
    }
    return count
  }

  async markInactiveForCompany(companyId: string, activeJobUrls: string[]): Promise<number> {
    const result = await this.prisma.job.updateMany({
      where: {
        companyId,
        isActive: true,
        ...(activeJobUrls.length > 0 ? { applyUrl: { notIn: activeJobUrls } } : {})
      },
      data: { isActive: false }
    })
    return result.count
  }

  async getSyncState(companyId: string): Promise<CompanyJobSyncState | null> {
    const row = await this.prisma.companyJobSyncState.findUnique({ where: { companyId } })
    return row ? this.toSyncStateDomain(row) : null
  }

  async updateSyncState(companyId: string, input: UpdateJobSyncStateInput): Promise<CompanyJobSyncState> {
    const row = await this.prisma.companyJobSyncState.upsert({
      where: { companyId },
      create: {
        companyId,
        lastFetchedAt: input.lastFetchedAt,
        lastSuccessfulFetchAt: input.lastSuccessfulFetchAt,
        lastFoundJobsAt: input.lastFoundJobsAt,
        lastAtsSource: input.lastAtsSource,
        lastStatus: input.lastStatus,
        failureCount: input.failureCount ?? 0,
        lastError: input.lastError
      },
      update: {
        ...(input.lastFetchedAt !== undefined ? { lastFetchedAt: input.lastFetchedAt } : {}),
        ...(input.lastSuccessfulFetchAt !== undefined ? { lastSuccessfulFetchAt: input.lastSuccessfulFetchAt } : {}),
        ...(input.lastFoundJobsAt !== undefined ? { lastFoundJobsAt: input.lastFoundJobsAt } : {}),
        ...(input.lastAtsSource !== undefined ? { lastAtsSource: input.lastAtsSource } : {}),
        ...(input.lastStatus !== undefined ? { lastStatus: input.lastStatus } : {}),
        ...(input.failureCount !== undefined ? { failureCount: input.failureCount } : {}),
        ...(input.lastError !== undefined ? { lastError: input.lastError } : {})
      }
    })
    return this.toSyncStateDomain(row)
  }

  private buildWhere(params: JobSearchParams): Prisma.JobWhereInput {
    return {
      ...(params.title ? { title: { contains: params.title, mode: 'insensitive' } } : {}),
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.isRemote !== undefined ? { isRemote: params.isRemote } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.techStack && params.techStack.length > 0 ? { techStack: { hasSome: params.techStack } } : {}),
      ...(params.batch || params.industry
        ? {
            company: {
              ...(params.batch ? { batch: params.batch } : {}),
              ...(params.industry ? { tags: { has: params.industry } } : {})
            }
          }
        : {})
    }
  }

  private toPrismaData(job: UpsertJobInput): Prisma.JobUncheckedCreateInput {
    return {
      companyId: job.companyId,
      title: job.title,
      location: job.location,
      isRemote: job.isRemote,
      description: job.description,
      techStack: job.techStack,
      atsSource: job.atsSource,
      applyUrl: job.applyUrl,
      isActive: job.isActive,
      postedAt: job.postedAt
    }
  }

  private toDomain(row: NonNullable<JobRow>): Job {
    return {
      id: row.id,
      companyId: row.companyId,
      title: row.title,
      location: row.location,
      isRemote: row.isRemote,
      description: row.description,
      techStack: row.techStack,
      atsSource: row.atsSource as ATSSource,
      applyUrl: row.applyUrl,
      isActive: row.isActive,
      postedAt: row.postedAt,
      fetchedAt: row.fetchedAt
    }
  }

  private toSyncStateDomain(row: NonNullable<JobSyncStateRow>): CompanyJobSyncState {
    return {
      id: row.id,
      companyId: row.companyId,
      lastFetchedAt: row.lastFetchedAt,
      lastSuccessfulFetchAt: row.lastSuccessfulFetchAt,
      lastFoundJobsAt: row.lastFoundJobsAt,
      lastAtsSource: row.lastAtsSource as ATSSource | null,
      lastStatus: row.lastStatus as JobSyncStatus | null,
      failureCount: row.failureCount,
      lastError: row.lastError,
      updatedAt: row.updatedAt
    }
  }
}
