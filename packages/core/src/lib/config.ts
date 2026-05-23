import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  GITHUB_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  CRUNCHBASE_API_KEY: z.string().optional(),
  PIPELINE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  PIPELINE_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
})

const parseResult = ConfigSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error('Invalid environment variables:')
  console.error(parseResult.error.format())
  process.exit(1)
}

export const config = parseResult.data
export type Config = typeof config
