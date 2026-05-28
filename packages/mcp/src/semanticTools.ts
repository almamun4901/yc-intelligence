import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { EmbeddingService, SemanticCompanySearchParams } from '@yc-intelligence/core'
import { z } from 'zod'
import { companyStatusSchema, type ToolServer } from './companyTools'

export type SemanticToolService = Pick<EmbeddingService, 'semanticSearch'>

export const semanticSearchInputSchema = {
  query: z.string().min(1),
  batch: z.string().optional(),
  status: companyStatusSchema.optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  isHiring: z.boolean().optional(),
  limit: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional()
}

export const registerSemanticTools = (server: ToolServer, semanticService: SemanticToolService) => {
  server.registerTool(
    'semantic_search',
    {
      title: 'Semantic search YC companies',
      description:
        'Find YC companies by natural-language intent, optionally constrained by batch, status, industry, location, and hiring status.',
      inputSchema: semanticSearchInputSchema
    },
    async (input: SemanticCompanySearchParams) => handleSemanticSearch(input, semanticService)
  )
}

export const handleSemanticSearch = async (
  input: SemanticCompanySearchParams,
  semanticService: SemanticToolService
): Promise<CallToolResult> => {
  const result = await semanticService.semanticSearch(input)

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            total: result.total,
            count: result.data.length,
            companies: result.data.map(({ company, score }) => ({
              name: company.name,
              slug: company.slug,
              score,
              batch: company.batch,
              status: company.status,
              shortDescription: company.shortDescription,
              website: company.website,
              isHiring: company.isHiring,
              tags: company.tags,
              location: company.location
            }))
          },
          null,
          2
        )
      }
    ]
  }
}
