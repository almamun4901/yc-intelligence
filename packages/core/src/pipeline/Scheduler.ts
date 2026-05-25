import cron, { type ScheduledTask } from 'node-cron'
import { createLogger } from '../lib/logger'
import type { PipelineMode, PipelineOrchestrator, PipelineRunOptions } from './PipelineOrchestrator'

const logger = createLogger('PipelineScheduler')
const DEFAULT_CRON = '0 3 * * *'

export interface PipelineSchedulerOptions {
  cronExpression?: string
  mode?: PipelineMode
  runOnStart?: boolean
  runOptions?: PipelineRunOptions
}

export class PipelineScheduler {
  private task: ScheduledTask | null = null
  private isRunning = false

  constructor(
    private readonly orchestrator: PipelineOrchestrator,
    private readonly options: PipelineSchedulerOptions = {}
  ) {}

  start(): void {
    if (this.task) return

    const cronExpression = this.options.cronExpression ?? DEFAULT_CRON
    this.task = cron.schedule(cronExpression, () => {
      void this.runOnce()
    })

    logger.info({ cronExpression, mode: this.mode }, 'Pipeline scheduler started')

    if (this.options.runOnStart) {
      void this.runOnce()
    }
  }

  stop(): void {
    this.task?.stop()
    this.task = null
    logger.info('Pipeline scheduler stopped')
  }

  async runOnce(): Promise<void> {
    if (this.isRunning) {
      logger.warn({ mode: this.mode }, 'Skipping scheduled pipeline run because a previous run is still active')
      return
    }

    this.isRunning = true
    try {
      await this.orchestrator.run(this.mode, this.options.runOptions)
    } finally {
      this.isRunning = false
    }
  }

  private get mode(): PipelineMode {
    return this.options.mode ?? 'refresh'
  }
}

export const createPipelineSchedulerOptions = (env: NodeJS.ProcessEnv = process.env): PipelineSchedulerOptions => ({
  cronExpression: env.PIPELINE_SCHEDULE_CRON ?? DEFAULT_CRON,
  mode: env.PIPELINE_SCHEDULE_MODE === 'seed' ? 'seed' : 'refresh',
  runOnStart: env.PIPELINE_RUN_ON_START === '1'
})
