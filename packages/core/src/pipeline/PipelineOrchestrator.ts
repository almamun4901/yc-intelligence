import { createLogger } from '../lib/logger'
import type { EmbeddingRefreshOptions, EmbeddingRefreshResult } from '../services'
import type { HNFetchResult, HNFetcherOptions, JobBoardFetchResult, YCFetchResult } from './fetchers'

const logger = createLogger('PipelineOrchestrator')

export const PIPELINE_STAGES = ['companies', 'jobs', 'hn', 'embeddings'] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]
export type PipelineMode = 'seed' | 'refresh'

export interface PipelineStageRunner<T> {
  run(): Promise<T>
}

export interface PipelineOrchestratorDependencies {
  companies: PipelineStageRunner<YCFetchResult>
  jobs: PipelineStageRunner<JobBoardFetchResult>
  hn: PipelineStageRunner<HNFetchResult>
  embeddings: PipelineStageRunner<EmbeddingRefreshResult>
}

export interface PipelineRunOptions {
  stages?: PipelineStage[]
  resumeFrom?: PipelineStage
}

export type PipelineStageResult =
  | { stage: 'companies'; result: YCFetchResult }
  | { stage: 'jobs'; result: JobBoardFetchResult }
  | { stage: 'hn'; result: HNFetchResult }
  | { stage: 'embeddings'; result: EmbeddingRefreshResult }

export interface PipelineRunResult {
  mode: PipelineMode
  startedAt: Date
  completedAt: Date
  stages: PipelineStageResult[]
}

export interface PipelineRuntimeOptions {
  jobLimit?: number
  jobOffset?: number
  hnLimit?: number
  hnLookbackDays?: number
  hnMaxPagesPerCompany?: number
  embeddingLimit?: number
  embeddingOffset?: number
  embeddingStaleOnly?: boolean
}

export class PipelineOrchestrator {
  constructor(private readonly dependencies: PipelineOrchestratorDependencies) {}

  async seed(options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
    return this.run('seed', options)
  }

  async refresh(options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
    return this.run('refresh', options)
  }

  async run(mode: PipelineMode, options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
    const startedAt = new Date()
    const stages = resolveStages(options)
    const results: PipelineStageResult[] = []

    logger.info({ mode, stages }, 'Pipeline run starting')

    for (const stage of stages) {
      const stageStartedAt = new Date()
      logger.info({ mode, stage }, 'Pipeline stage starting')

      try {
        const result = await this.runStage(stage)
        results.push({ stage, result } as PipelineStageResult)
        logger.info({ mode, stage, durationMs: Date.now() - stageStartedAt.getTime(), result }, 'Pipeline stage complete')
      } catch (error) {
        logger.error({ mode, stage, error }, 'Pipeline stage failed')
        throw error
      }
    }

    const completedAt = new Date()
    const runResult = {
      mode,
      startedAt,
      completedAt,
      stages: results
    }
    logger.info(
      { mode, durationMs: completedAt.getTime() - startedAt.getTime(), stages: results.map((stage) => stage.stage) },
      'Pipeline run complete'
    )

    return runResult
  }

  private async runStage(stage: PipelineStage): Promise<PipelineStageResult['result']> {
    return this.dependencies[stage].run()
  }
}

export const resolveStages = (options: PipelineRunOptions = {}): PipelineStage[] => {
  const requestedStages = options.stages?.length ? dedupeStages(options.stages) : [...PIPELINE_STAGES]
  if (!options.resumeFrom) return requestedStages

  const resumeIndex = requestedStages.indexOf(options.resumeFrom)
  if (resumeIndex === -1) {
    throw new Error(`Cannot resume from "${options.resumeFrom}" because it is not in the selected stages`)
  }

  return requestedStages.slice(resumeIndex)
}

export const parsePipelineStages = (value: string | undefined): PipelineStage[] | undefined => {
  if (!value?.trim()) return undefined

  const stages = value
    .split(',')
    .map((stage) => stage.trim())
    .filter((stage) => stage.length > 0)

  return dedupeStages(stages.map(toPipelineStage))
}

export const toPipelineStage = (value: string): PipelineStage => {
  if (isPipelineStage(value)) return value
  throw new Error(`Unknown pipeline stage "${value}". Valid stages: ${PIPELINE_STAGES.join(', ')}`)
}

export const createPipelineRunOptions = (env: NodeJS.ProcessEnv = process.env): PipelineRunOptions => ({
  ...(parsePipelineStages(env.PIPELINE_STAGES) ? { stages: parsePipelineStages(env.PIPELINE_STAGES) } : {}),
  ...(env.PIPELINE_RESUME_FROM ? { resumeFrom: toPipelineStage(env.PIPELINE_RESUME_FROM) } : {})
})

export const createPipelineRuntimeOptions = (env: NodeJS.ProcessEnv = process.env): PipelineRuntimeOptions => ({
  jobLimit: parsePositiveInteger(env.JOB_PIPELINE_LIMIT),
  jobOffset: parseNonNegativeInteger(env.JOB_PIPELINE_OFFSET),
  hnLimit: parsePositiveInteger(env.HN_PIPELINE_LIMIT),
  hnLookbackDays: parsePositiveInteger(env.HN_LOOKBACK_DAYS),
  hnMaxPagesPerCompany: parsePositiveInteger(env.HN_MAX_PAGES_PER_COMPANY),
  embeddingLimit: parsePositiveInteger(env.EMBEDDING_PIPELINE_LIMIT),
  embeddingOffset: parsePositiveInteger(env.EMBEDDING_PIPELINE_OFFSET),
  embeddingStaleOnly: env.EMBEDDING_PIPELINE_STALE_ONLY === '1'
})

export const createEmbeddingRefreshOptions = (options: PipelineRuntimeOptions): EmbeddingRefreshOptions => ({
  limit: options.embeddingLimit,
  offset: options.embeddingOffset,
  staleOnly: options.embeddingStaleOnly
})

export const createHNFetcherOptions = (options: PipelineRuntimeOptions): HNFetcherOptions => ({
  maxCompanies: options.hnLimit,
  lookbackDays: options.hnLookbackDays,
  maxPagesPerCompany: options.hnMaxPagesPerCompany
})

export const createJobFetcherOptions = (options: PipelineRuntimeOptions): { maxCompanies?: number; offset?: number } => ({
  maxCompanies: options.jobLimit,
  offset: options.jobOffset
})

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const parseNonNegativeInteger = (value: string | undefined): number | undefined => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

const dedupeStages = (stages: PipelineStage[]): PipelineStage[] => [...new Set(stages)]

const isPipelineStage = (value: string): value is PipelineStage =>
  PIPELINE_STAGES.includes(value as PipelineStage)
