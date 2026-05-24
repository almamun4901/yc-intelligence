import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { HNPostSearchParams, HNPostType, HNService } from '@yc-intelligence/core'
import { z } from 'zod'
import type { ToolServer } from './companyTools'

export type HNToolService = Pick<HNService, 'searchHNActivity'>

const hnPostTypeSchema = z.enum(['Show HN', 'Ask HN', 'Launch', 'Hiring', 'Other'])

export const getHNActivityInputSchema = {
  companySlug: z.string().optional(),
  companyName: z.string().optional(),
  batch: z.string().optional(),
  industry: z.string().optional(),
  postType: hnPostTypeSchema.optional(),
  since: z.string().datetime().optional(),
  minPoints: z.number().int().min(0).optional(),
  limit: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional()
}

type GetHNActivityInput = {
  companySlug?: string
  companyName?: string
  batch?: string
  industry?: string
  postType?: HNPostType
  since?: string
  minPoints?: number
  limit?: number
  offset?: number
}

export const registerHNTools = (server: ToolServer, hnService: HNToolService) => {
  server.registerTool(
    'get_hn_activity',
    {
      title: 'Get YC company Hacker News activity',
      description: 'Search Hacker News posts linked to YC companies by company, batch, industry, post type, date, and points.',
      inputSchema: getHNActivityInputSchema
    },
    async (input: GetHNActivityInput) => handleGetHNActivity(input, hnService)
  )
}

export const handleGetHNActivity = async (
  input: GetHNActivityInput,
  hnService: HNToolService
): Promise<CallToolResult> => {
  const params: HNPostSearchParams = {
    companySlug: input.companySlug,
    companyName: input.companyName,
    batch: input.batch,
    industry: input.industry,
    postType: input.postType,
    since: input.since ? new Date(input.since) : undefined,
    minPoints: input.minPoints,
    limit: input.limit,
    offset: input.offset
  }
  const result = await hnService.searchHNActivity(params)

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            total: result.total,
            count: result.data.length,
            posts: result.data.map((post) => ({
              company: post.company
                ? {
                    name: post.company.name,
                    slug: post.company.slug,
                    batch: post.company.batch
                  }
                : { id: post.companyId },
              title: post.title,
              url: post.url,
              author: post.author,
              points: post.points,
              comments: post.commentCount,
              postType: post.postType,
              postedAt: post.postedAt.toISOString()
            }))
          },
          null,
          2
        )
      }
    ]
  }
}
