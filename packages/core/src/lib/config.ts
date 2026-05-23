import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url().default('postgresql://yc_user:yc_password@localhost:5433/yc_intelligence'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  GITHUB_TOKEN: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  CRUNCHBASE_API_KEY: z.string().default(''),
  PIPELINE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  PIPELINE_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
})

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parseResult = ConfigSchema.safeParse(env)

  if (!parseResult.success) {
    throw new Error(`Invalid environment variables: ${JSON.stringify(parseResult.error.format())}`)
  }

  return parseResult.data
}

export const config = loadConfig()
export type Config = typeof config
