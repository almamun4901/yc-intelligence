import axios, { type AxiosAdapter, type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { config } from './config'
import { createLogger } from './logger'

const logger = createLogger('HttpClient')

interface RetryableAxiosConfig extends AxiosRequestConfig {
  _retryCount?: number
}

export interface RetryConfig {
  maxRetries?: number
  delayMs?: number
  backoffFactor?: number
  adapter?: AxiosAdapter
}

export function createHttpClient(baseURL?: string, retryConfig: RetryConfig = {}): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 15_000, adapter: retryConfig.adapter })
  const {
    maxRetries = 3,
    delayMs = config.PIPELINE_DELAY_MS,
    backoffFactor = 2
  } = retryConfig

  client.interceptors.request.use(async (request) => {
    if (delayMs > 0) await sleep(delayMs)
    logger.info({ url: request.url, method: request.method }, 'HTTP request')
    return request
  })

  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) throw error

      const requestConfig = error.config as RetryableAxiosConfig | undefined
      if (!requestConfig) throw error

      requestConfig._retryCount = requestConfig._retryCount ?? 0
      const status = error.response?.status
      const shouldRetry =
        requestConfig._retryCount < maxRetries &&
        (status === 429 || (status !== undefined && status >= 500 && status < 600))

      if (!shouldRetry) throw error

      requestConfig._retryCount += 1
      const waitMs = delayMs * Math.pow(backoffFactor, requestConfig._retryCount)

      logger.warn(
        { url: requestConfig.url, status, attempt: requestConfig._retryCount },
        `Retrying request in ${waitMs}ms`
      )

      if (waitMs > 0) await sleep(waitMs)
      return client(requestConfig)
    }
  )

  return client
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
