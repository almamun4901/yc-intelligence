import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config'

describe('loadConfig', () => {
  it('accepts valid environment values', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://yc_user:yc_password@localhost:5433/yc_intelligence',
      REDIS_URL: 'redis://localhost:6379',
      GITHUB_TOKEN: 'ghp_test',
      OPENAI_API_KEY: 'sk-test',
      PIPELINE_CONCURRENCY: '3',
      PIPELINE_DELAY_MS: '50',
      NODE_ENV: 'test'
    })

    expect(config.DATABASE_URL).toContain('yc_intelligence')
    expect(config.PIPELINE_CONCURRENCY).toBe(3)
    expect(config.PIPELINE_DELAY_MS).toBe(50)
    expect(config.NODE_ENV).toBe('test')
  })

  it('uses local development defaults for phase 1', () => {
    const config = loadConfig({})

    expect(config.DATABASE_URL).toBe('postgresql://yc_user:yc_password@localhost:5433/yc_intelligence')
    expect(config.REDIS_URL).toBe('redis://localhost:6379')
    expect(config.GITHUB_TOKEN).toBe('')
    expect(config.OPENAI_API_KEY).toBe('')
  })

  it('rejects invalid environment values', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'not-a-url',
        PIPELINE_CONCURRENCY: '0',
        NODE_ENV: 'staging'
      })
    ).toThrow('Invalid environment variables')
  })
})
