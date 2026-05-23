import { PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'

;(runIntegration ? describe : describe.skip)('memory Prisma schema integration', () => {
  const prisma = new PrismaClient()

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates memory tables and enforces the 500 character source excerpt cap', async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('memory_entries', 'memory_sources', 'refresh_logs')
    `

    expect(tables.map((table) => table.tablename).sort()).toEqual([
      'memory_entries',
      'memory_sources',
      'refresh_logs'
    ])

    const excerptColumn = await prisma.$queryRaw<Array<{ character_maximum_length: number }>>`
      SELECT character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'memory_sources'
        AND column_name = 'sourceExcerpt'
    `

    expect(excerptColumn[0]?.character_maximum_length).toBe(500)
  })
})
