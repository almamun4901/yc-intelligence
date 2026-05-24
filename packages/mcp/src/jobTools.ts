import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { JobSearchParams, JobService } from '@yc-intelligence/core'
import { z } from 'zod'
import type { ToolServer } from './companyTools'

export type JobToolService = Pick<JobService, 'searchJobs'>

export const searchJobsInputSchema = {
  techStack: z.array(z.string()).optional(),
  title: z.string().optional(),
  companyId: z.string().optional(),
  isRemote: z.boolean().optional(),
  batch: z.string().optional(),
  industry: z.string().optional(),
  limit: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional()
}

export const registerJobTools = (server: ToolServer, jobService: JobToolService) => {
  server.registerTool(
    'search_jobs',
    {
      title: 'Search YC company jobs',
      description: 'Search open YC company jobs by title, tech stack, remote status, batch, and industry.',
      inputSchema: searchJobsInputSchema
    },
    async (input: JobSearchParams) => handleSearchJobs(input, jobService)
  )
}

export const handleSearchJobs = async (
  input: JobSearchParams,
  jobService: JobToolService
): Promise<CallToolResult> => {
  const result = await jobService.searchJobs(input)

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            total: result.total,
            count: result.data.length,
            jobs: result.data.map((job) => ({
              title: job.title,
              companyId: job.companyId,
              location: job.location,
              isRemote: job.isRemote,
              techStack: job.techStack,
              applyUrl: job.applyUrl,
              postedAt: job.postedAt?.toISOString() ?? null
            }))
          },
          null,
          2
        )
      }
    ]
  }
}
