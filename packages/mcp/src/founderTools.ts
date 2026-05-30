import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { FounderSearchParams, FounderService } from '@yc-intelligence/core'
import { z } from 'zod'
import type { ToolServer } from './companyTools'

export type FounderToolService = Pick<FounderService, 'searchFounders'>

export const searchFoundersInputSchema = {
  query: z.string().optional(),
  companyId: z.string().optional(),
  company: z.string().optional(),
  batch: z.string().optional(),
  industry: z.string().optional(),
  previousEmployer: z.string().optional(),
  school: z.string().optional(),
  limit: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional()
}

export const registerFounderTools = (server: ToolServer, founderService: FounderToolService) => {
  server.registerTool(
    'search_founders',
    {
      title: 'Search YC founders',
      description: 'Search YC founders by name, company, batch, industry, previous employer, or school.',
      inputSchema: searchFoundersInputSchema
    },
    async (input: FounderSearchParams) => handleSearchFounders(input, founderService)
  )
}

export const handleSearchFounders = async (
  input: FounderSearchParams,
  founderService: FounderToolService
): Promise<CallToolResult> => {
  const result = await founderService.searchFounders(input)

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            total: result.total,
            count: result.data.length,
            founders: result.data.map((founder) => ({
              name: founder.name,
              linkedinUrl: founder.linkedinUrl,
              previousEmployers: founder.previousEmployers,
              schools: founder.schools,
              company: {
                name: founder.company.name,
                slug: founder.company.slug,
                batch: founder.company.batch,
                status: founder.company.status,
                shortDescription: founder.company.shortDescription,
                website: founder.company.website,
                isHiring: founder.company.isHiring,
                tags: founder.company.tags,
                location: founder.company.location
              }
            }))
          },
          null,
          2
        )
      }
    ]
  }
}
