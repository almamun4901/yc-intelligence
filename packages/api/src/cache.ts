import { createClient } from 'redis'

export interface ApiLogger {
  info(value: unknown, message?: string): void
  warn(value: unknown, message?: string): void
  error(value: unknown, message?: string): void
}

export interface ResponseCache {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  close(): Promise<void>
}

export const COMPANY_CACHE_TTL_SECONDS = 60

export const createCacheKey = (method: string, url: string): string => {
  const parsed = new URL(url, 'http://localhost')
  const params = new URLSearchParams()

  Array.from(parsed.searchParams.entries())
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey)
    )
    .forEach(([key, value]) => params.append(key, value))

  const query = params.toString()
  return `api:${method.toUpperCase()}:${parsed.pathname}${query ? `?${query}` : ''}`
}

export const createRedisResponseCache = (url: string, logger: ApiLogger): ResponseCache => {
  const client = createClient({ url })
  let connectPromise: Promise<void> | null = null
  let disabled = false

  client.on('error', (err) => {
    logger.warn({ err }, 'Redis cache error')
  })

  const connect = async () => {
    if (disabled || client.isOpen) return
    connectPromise ??= client.connect().then(() => undefined)

    try {
      await connectPromise
    } catch (err) {
      disabled = true
      logger.warn({ err }, 'Redis cache unavailable; continuing without cache')
    }
  }

  return {
    async get(key: string): Promise<string | null> {
      await connect()
      if (disabled || !client.isOpen) return null
      return client.get(key)
    },

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      await connect()
      if (disabled || !client.isOpen) return
      await client.set(key, value, { EX: ttlSeconds })
    },

    async close(): Promise<void> {
      if (client.isOpen) {
        await client.quit()
      }
    }
  }
}
