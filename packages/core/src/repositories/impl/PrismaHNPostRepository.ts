import type { Prisma, PrismaClient } from '@prisma/client'
import type { CompanyHNSyncState, HNPost, HNPostSearchParams, HNPostType } from '../../domain'
import type { IHNPostRepository, UpdateHNSyncStateInput, UpsertHNPostInput } from '../IHNPostRepository'

type HNPostRow = Awaited<ReturnType<PrismaClient['hNPost']['findFirst']>>
type HNSyncStateRow = Awaited<ReturnType<PrismaClient['companyHNSyncState']['findFirst']>>

export class PrismaHNPostRepository implements IHNPostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertMany(posts: UpsertHNPostInput[]): Promise<number> {
    let count = 0
    for (const post of posts) {
      await this.prisma.hNPost.upsert({
        where: { hnObjectId: post.hnObjectId },
        create: this.toPrismaData(post),
        update: this.toPrismaData(post)
      })
      count += 1
    }
    return count
  }

  async search(params: HNPostSearchParams): Promise<{ data: HNPost[]; total: number }> {
    const where = this.buildWhere(params)
    const orderBy =
      params.sort === 'newest'
        ? [{ postedAt: 'desc' as const }, { points: 'desc' as const }]
        : [
            { relevanceScore: 'desc' as const },
            { points: 'desc' as const },
            { commentCount: 'desc' as const },
            { postedAt: 'desc' as const }
          ]

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.hNPost.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              batch: true,
              tags: true
            }
          }
        },
        orderBy,
        take: params.limit ?? 20,
        skip: params.offset ?? 0
      }),
      this.prisma.hNPost.count({ where })
    ])

    return { data: rows.map((row) => this.toDomain(row)), total }
  }

  async getSyncState(companyId: string): Promise<CompanyHNSyncState | null> {
    const row = await this.prisma.companyHNSyncState.findUnique({ where: { companyId } })
    return row ? this.toSyncStateDomain(row) : null
  }

  async updateSyncState(companyId: string, input: UpdateHNSyncStateInput): Promise<CompanyHNSyncState> {
    const row = await this.prisma.companyHNSyncState.upsert({
      where: { companyId },
      create: {
        companyId,
        lastFetchedAt: input.lastFetchedAt,
        lastSuccessfulSearchAt: input.lastSuccessfulSearchAt,
        lastSeenPostedAt: input.lastSeenPostedAt,
        failureCount: input.failureCount ?? 0,
        lastError: input.lastError
      },
      update: {
        ...(input.lastFetchedAt !== undefined ? { lastFetchedAt: input.lastFetchedAt } : {}),
        ...(input.lastSuccessfulSearchAt !== undefined
          ? { lastSuccessfulSearchAt: input.lastSuccessfulSearchAt }
          : {}),
        ...(input.lastSeenPostedAt !== undefined ? { lastSeenPostedAt: input.lastSeenPostedAt } : {}),
        ...(input.failureCount !== undefined ? { failureCount: input.failureCount } : {}),
        ...(input.lastError !== undefined ? { lastError: input.lastError } : {})
      }
    })
    return this.toSyncStateDomain(row)
  }

  private buildWhere(params: HNPostSearchParams): Prisma.HNPostWhereInput {
    return {
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.postType ? { postType: params.postType } : {}),
      ...(params.minPoints !== undefined ? { points: { gte: params.minPoints } } : {}),
      ...(params.minRelevanceScore !== undefined ? { relevanceScore: { gte: params.minRelevanceScore } } : {}),
      ...(params.since || params.until
        ? {
            postedAt: {
              ...(params.since ? { gte: params.since } : {}),
              ...(params.until ? { lte: params.until } : {})
            }
          }
        : {}),
      ...(params.companySlug || params.companyName || params.batch || params.industry
        ? {
            company: {
              ...(params.companySlug ? { slug: params.companySlug } : {}),
              ...(params.companyName ? { name: { contains: params.companyName, mode: 'insensitive' } } : {}),
              ...(params.batch ? { batch: params.batch } : {}),
              ...(params.industry ? { tags: { has: params.industry } } : {})
            }
          }
        : {})
    }
  }

  private toPrismaData(post: UpsertHNPostInput): Prisma.HNPostUncheckedCreateInput {
    return {
      companyId: post.companyId,
      hnObjectId: post.hnObjectId,
      hnItemId: post.hnItemId,
      title: post.title,
      url: post.url,
      author: post.author,
      points: post.points,
      commentCount: post.commentCount,
      relevanceScore: post.relevanceScore,
      matchReasons: post.matchReasons as Prisma.InputJsonValue,
      postType: post.postType,
      postedAt: post.postedAt,
      rawData: post.rawData as Prisma.InputJsonValue | undefined
    }
  }

  private toDomain(row: NonNullable<HNPostRow> & { company?: HNPost['company'] }): HNPost {
    return {
      id: row.id,
      companyId: row.companyId,
      company: row.company,
      hnObjectId: row.hnObjectId,
      hnItemId: row.hnItemId,
      title: row.title,
      url: row.url,
      author: row.author,
      points: row.points,
      commentCount: row.commentCount,
      relevanceScore: row.relevanceScore,
      matchReasons: Array.isArray(row.matchReasons) ? row.matchReasons.filter((reason): reason is string => typeof reason === 'string') : [],
      postType: row.postType as HNPostType,
      postedAt: row.postedAt,
      fetchedAt: row.fetchedAt,
      rawData: row.rawData
    }
  }

  private toSyncStateDomain(row: NonNullable<HNSyncStateRow>): CompanyHNSyncState {
    return {
      id: row.id,
      companyId: row.companyId,
      lastFetchedAt: row.lastFetchedAt,
      lastSuccessfulSearchAt: row.lastSuccessfulSearchAt,
      lastSeenPostedAt: row.lastSeenPostedAt,
      failureCount: row.failureCount,
      lastError: row.lastError,
      updatedAt: row.updatedAt
    }
  }
}
