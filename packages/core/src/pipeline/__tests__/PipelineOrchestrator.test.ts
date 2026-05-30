import { describe, expect, it, vi } from 'vitest'
import {
  createPipelineRunOptions,
  createPipelineRuntimeOptions,
  parsePipelineStages,
  PipelineOrchestrator,
  resolveStages
} from '../PipelineOrchestrator'

describe('PipelineOrchestrator', () => {
  it('runs the full pipeline in dependency order', async () => {
    const calls: string[] = []
    const orchestrator = new PipelineOrchestrator({
      companies: companiesRunner(calls),
      founders: foundersRunner(calls),
      jobs: jobsRunner(calls),
      hn: hnRunner(calls),
      embeddings: embeddingsRunner(calls)
    })

    const result = await orchestrator.seed()

    expect(calls).toEqual(['companies', 'founders', 'jobs', 'hn', 'embeddings'])
    expect(result.mode).toBe('seed')
    expect(result.stages.map((stage) => stage.stage)).toEqual(['companies', 'founders', 'jobs', 'hn', 'embeddings'])
  })

  it('supports selected stages and resume-from semantics', async () => {
    const calls: string[] = []
    const orchestrator = new PipelineOrchestrator({
      companies: companiesRunner(calls),
      founders: foundersRunner(calls),
      jobs: jobsRunner(calls),
      hn: hnRunner(calls),
      embeddings: embeddingsRunner(calls)
    })

    const result = await orchestrator.refresh({
      stages: ['companies', 'jobs', 'hn', 'embeddings'],
      resumeFrom: 'hn'
    })

    expect(calls).toEqual(['hn', 'embeddings'])
    expect(result.stages.map((stage) => stage.stage)).toEqual(['hn', 'embeddings'])
  })

  it('stops on the first failed stage', async () => {
    const calls: string[] = []
    const orchestrator = new PipelineOrchestrator({
      companies: companiesRunner(calls),
      founders: foundersRunner(calls),
      jobs: {
        run: vi.fn(async () => {
          calls.push('jobs')
          throw new Error('job pipeline failed')
        })
      },
      hn: hnRunner(calls),
      embeddings: embeddingsRunner(calls)
    })

    await expect(orchestrator.refresh()).rejects.toThrow('job pipeline failed')
    expect(calls).toEqual(['companies', 'founders', 'jobs'])
  })
})

describe('pipeline option parsing', () => {
  it('parses comma-separated stage lists', () => {
    expect(parsePipelineStages('companies, founders,jobs,hn, jobs')).toEqual(['companies', 'founders', 'jobs', 'hn'])
  })

  it('rejects unknown stages', () => {
    expect(() => parsePipelineStages('companies,github')).toThrow('Unknown pipeline stage')
  })

  it('resolves resume-from against the selected stage list', () => {
    expect(resolveStages({ stages: ['jobs', 'hn', 'embeddings'], resumeFrom: 'hn' })).toEqual(['hn', 'embeddings'])
    expect(() => resolveStages({ stages: ['jobs'], resumeFrom: 'hn' })).toThrow('Cannot resume')
  })

  it('normalizes runtime and run options from env', () => {
    expect(
      createPipelineRunOptions({
        PIPELINE_STAGES: 'jobs,hn',
        PIPELINE_RESUME_FROM: 'hn'
      })
    ).toEqual({ stages: ['jobs', 'hn'], resumeFrom: 'hn' })

    expect(
      createPipelineRuntimeOptions({
        JOB_PIPELINE_LIMIT: '10',
        JOB_PIPELINE_OFFSET: '5',
        FOUNDER_PIPELINE_LIMIT: '12',
        FOUNDER_PIPELINE_OFFSET: '3',
        HN_PIPELINE_LIMIT: '20',
        HN_LOOKBACK_DAYS: '14',
        HN_MAX_PAGES_PER_COMPANY: '2',
        EMBEDDING_PIPELINE_LIMIT: '30',
        EMBEDDING_PIPELINE_OFFSET: '40',
        EMBEDDING_PIPELINE_STATUS: 'Active',
        EMBEDDING_PIPELINE_BATCH_SIZE: '8',
        EMBEDDING_PIPELINE_STALE_ONLY: '1'
      })
    ).toEqual({
      jobLimit: 10,
      jobOffset: 5,
      founderLimit: 12,
      founderOffset: 3,
      hnLimit: 20,
      hnLookbackDays: 14,
      hnMaxPagesPerCompany: 2,
      embeddingLimit: 30,
      embeddingOffset: 40,
      embeddingStatus: 'Active',
      embeddingBatchSize: 8,
      embeddingStaleOnly: true
    })
  })
})

const companiesRunner = (calls: string[]) => ({
  run: vi.fn(async () => {
    calls.push('companies')
    return { pagesFetched: 1, rawCompaniesFetched: 1, companiesUpserted: 1, foundersUpserted: 0 }
  })
})

const foundersRunner = (calls: string[]) => ({
  run: vi.fn(async () => {
    calls.push('founders')
    return {
      totalCompanies: 1,
      offset: 0,
      limit: 1,
      processed: 1,
      pagesFetched: 1,
      foundersFound: 1,
      foundersUpserted: 1,
      companiesWithFounders: 1,
      companiesWithoutFounders: 0,
      errors: 0
    }
  })
})

const jobsRunner = (calls: string[]) => ({
  run: vi.fn(async () => {
    calls.push('jobs')
    return {
      totalCompanies: 1,
      offset: 0,
      limit: 10000,
      processed: 1,
      jobsFound: 1,
      jobsUpserted: 1,
      companiesWithJobs: 1,
      companiesWithZeroJobs: 0,
      companiesWithoutSupportedBoard: 0,
      transientFailures: 0,
      parserFailures: 0,
      inactiveMarked: 0,
      errors: 0
    }
  })
})

const hnRunner = (calls: string[]) => ({
  run: vi.fn(async () => {
    calls.push('hn')
    return { processed: 1, postsFound: 1, postsUpserted: 1, errors: 0 }
  })
})

const embeddingsRunner = (calls: string[]) => ({
  run: vi.fn(async () => {
    calls.push('embeddings')
    return { processed: 1, generated: 1, skipped: 0 }
  })
})
