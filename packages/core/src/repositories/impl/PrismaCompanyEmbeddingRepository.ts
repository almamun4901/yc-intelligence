import { randomUUID } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import type { Company, CompanyEmbedding, SemanticCompanySearchMatch } from '../../domain'
import { EMBEDDING_DIMENSION } from '../../lib/embeddingProvider'
import type {
  ICompanyEmbeddingRepository,
  SimilarCompanySearchParams,
  UpsertCompanyEmbeddingInput
} from '../ICompanyEmbeddingRepository'

interface CompanyEmbeddingRow {
  id: string
  companyId: string
  sourceText: string
  sourceHash: string
  embeddingModel: string
  createdAt: Date
  updatedAt: Date
}

interface SimilarCompanyRow {
  id: string
  name: string
  slug: string
  batch: string | null
  status: string
  description: string | null
  shortDescription: string | null
  website: string | null
  teamSize: string | null
  isHiring: boolean
  tags: string[]
  location: string | null
  createdAt: Date
  updatedAt: Date
  score: number
  total: bigint
}

export class PrismaCompanyEmbeddingRepository implements ICompanyEmbeddingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCompanyId(companyId: string): Promise<CompanyEmbedding | null> {
    const rows = await this.prisma.$queryRaw<CompanyEmbeddingRow[]>`
      SELECT
        "id",
        "companyId",
        "sourceText",
        "sourceHash",
        "embeddingModel",
        "createdAt",
        "updatedAt"
      FROM "company_embeddings"
      WHERE "companyId" = ${companyId}
      LIMIT 1
    `
    return rows[0] ? this.toEmbeddingDomain(rows[0]) : null
  }

  async upsert(input: UpsertCompanyEmbeddingInput): Promise<CompanyEmbedding> {
    const vector = toVectorLiteral(input.embedding)
    const rows = await this.prisma.$queryRawUnsafe<CompanyEmbeddingRow[]>(
      `
        INSERT INTO "company_embeddings"
          ("id", "companyId", "sourceText", "sourceHash", "embeddingModel", "embedding")
        VALUES ($1, $2, $3, $4, $5, $6::vector)
        ON CONFLICT ("companyId") DO UPDATE SET
          "sourceText" = EXCLUDED."sourceText",
          "sourceHash" = EXCLUDED."sourceHash",
          "embeddingModel" = EXCLUDED."embeddingModel",
          "embedding" = EXCLUDED."embedding",
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING
          "id",
          "companyId",
          "sourceText",
          "sourceHash",
          "embeddingModel",
          "createdAt",
          "updatedAt"
      `,
      randomUUID(),
      input.companyId,
      input.sourceText,
      input.sourceHash,
      input.embeddingModel,
      vector
    )

    return this.toEmbeddingDomain(rows[0])
  }

  async searchSimilar(params: SimilarCompanySearchParams): Promise<{ data: SemanticCompanySearchMatch[]; total: number }> {
    const vector = toVectorLiteral(params.embedding)
    const values: unknown[] = [vector, params.embeddingModel]
    const filters = ['ce."embeddingModel" = $2']

    if (params.batch) {
      values.push(params.batch)
      filters.push(`c."batch" = $${values.length}`)
    }
    if (params.status) {
      values.push(params.status)
      filters.push(`c."status" = $${values.length}`)
    }
    if (params.industry) {
      values.push(params.industry)
      filters.push(`c."tags" @> ARRAY[$${values.length}]::TEXT[]`)
    }
    if (params.location) {
      values.push(`%${escapeLike(params.location)}%`)
      filters.push(`c."location" ILIKE $${values.length} ESCAPE '\\'`)
    }
    if (params.isHiring !== undefined) {
      values.push(params.isHiring)
      filters.push(`c."isHiring" = $${values.length}`)
    }

    const limit = params.limit ?? 10
    const offset = params.offset ?? 0
    values.push(limit, offset)
    const limitPlaceholder = `$${values.length - 1}`
    const offsetPlaceholder = `$${values.length}`

    const rows = await this.prisma.$queryRawUnsafe<SimilarCompanyRow[]>(
      `
        SELECT
          c."id",
          c."name",
          c."slug",
          c."batch",
          c."status",
          c."description",
          c."shortDescription",
          c."website",
          c."teamSize",
          c."isHiring",
          c."tags",
          c."location",
          c."createdAt",
          c."updatedAt",
          1 - (ce."embedding" <=> $1::vector) AS "score",
          COUNT(*) OVER() AS "total"
        FROM "company_embeddings" ce
        INNER JOIN "companies" c ON c."id" = ce."companyId"
        WHERE ${filters.join(' AND ')}
        ORDER BY ce."embedding" <=> $1::vector ASC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      ...values
    )

    return {
      data: rows.map((row) => ({ company: this.toCompanyDomain(row), score: Number(row.score) })),
      total: Number(rows[0]?.total ?? 0)
    }
  }

  private toEmbeddingDomain(row: CompanyEmbeddingRow): CompanyEmbedding {
    return {
      id: row.id,
      companyId: row.companyId,
      sourceText: row.sourceText,
      sourceHash: row.sourceHash,
      embeddingModel: row.embeddingModel,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }

  private toCompanyDomain(row: SimilarCompanyRow): Company {
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

const toVectorLiteral = (embedding: number[]): string => {
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Expected embedding dimension ${EMBEDDING_DIMENSION}, received ${embedding.length}`)
  }

  return `[${embedding.map((value) => {
    if (!Number.isFinite(value)) throw new Error('Embedding contains a non-finite value')
    return value
  }).join(',')}]`
}

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`)
