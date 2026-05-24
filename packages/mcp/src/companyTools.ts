import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { CompanySearchParams, CompanyService } from '@yc-intelligence/core'
import { z } from 'zod'

export type CompanyToolService = Pick<CompanyService, 'searchCompanies' | 'getCompanyDetail'>
type ToolHandler<TInput> = (input: TInput) => Promise<CallToolResult>

export interface ToolServer {
  registerTool<TInput>(
    name: string,
    config: {
      title?: string
      description?: string
      inputSchema?: Record<string, z.ZodType>
    },
    handler: ToolHandler<TInput>
  ): unknown
}

export const companyStatusSchema = z.enum(['Active', 'Acquired', 'Inactive', 'Dead'])

export const searchCompaniesInputSchema = {
  query: z.string().optional(),
  batch: z.string().optional(),
  status: companyStatusSchema.optional(),
  industry: z.string().optional(),
  isHiring: z.boolean().optional(),
  limit: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional()
}

export const getCompanyDetailInputSchema = {
  slug: z.string().min(1)
}

type GetCompanyDetailInput = {
  slug: string
}

export const registerCompanyTools = (server: ToolServer, companyService: CompanyToolService) => {
  server.registerTool(
    'search_companies',
    {
      title: 'Search YC companies',
      description: 'Search YC companies by text query, batch, status, industry tag, and hiring status.',
      inputSchema: searchCompaniesInputSchema
    },
    async (input: CompanySearchParams) => handleSearchCompanies(input, companyService)
  )

  server.registerTool(
    'get_company_detail',
    {
      title: 'Get YC company detail',
      description: 'Get one YC company profile by YC slug, including founders when available.',
      inputSchema: getCompanyDetailInputSchema
    },
    async (input: GetCompanyDetailInput) => handleGetCompanyDetail(input, companyService)
  )
}

export const handleSearchCompanies = async (
  input: CompanySearchParams,
  companyService: CompanyToolService
): Promise<CallToolResult> => {
  const result = await companyService.searchCompanies(input)

  return jsonResult({
    total: result.total,
    count: result.data.length,
    companies: result.data.map((company) => ({
      name: company.name,
      slug: company.slug,
      batch: company.batch,
      status: company.status,
      shortDescription: company.shortDescription,
      website: company.website,
      teamSize: company.teamSize,
      isHiring: company.isHiring,
      tags: company.tags,
      location: company.location
    }))
  })
}

export const handleGetCompanyDetail = async (
  input: GetCompanyDetailInput,
  companyService: CompanyToolService
): Promise<CallToolResult> => {
  const detail = await companyService.getCompanyDetail(input.slug)

  if (!detail) {
    return jsonResult({
      found: false,
      slug: input.slug,
      message: `No YC company found for slug: ${input.slug}`
    })
  }

  return jsonResult({
    found: true,
    company: {
      name: detail.name,
      slug: detail.slug,
      batch: detail.batch,
      status: detail.status,
      description: detail.description,
      shortDescription: detail.shortDescription,
      website: detail.website,
      teamSize: detail.teamSize,
      isHiring: detail.isHiring,
      tags: detail.tags,
      location: detail.location,
      founders: detail.founders.map((founder) => ({
        name: founder.name,
        linkedinUrl: founder.linkedinUrl,
        previousEmployers: founder.previousEmployers,
        schools: founder.schools
      })),
      hnPosts: detail.hnPosts.map((post) => ({
        title: post.title,
        url: post.url,
        author: post.author,
        points: post.points,
        comments: post.commentCount,
        postType: post.postType,
        postedAt: post.postedAt.toISOString()
      })),
      updatedAt: detail.updatedAt.toISOString()
    }
  })
}

const jsonResult = (value: unknown): CallToolResult => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(value, null, 2)
    }
  ]
})
