import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { createHttpClient } from '../httpClient'

describe('createHttpClient', () => {
  it('retries 429 responses and eventually succeeds', async () => {
    let attempts = 0
    const adapter: AxiosAdapter = async (config) => {
      attempts += 1
      if (attempts < 3) {
        throw makeAxiosError(config, 429)
      }

      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      }
    }

    const client = createHttpClient(undefined, { delayMs: 0, maxRetries: 3, adapter })
    const result = await client.get('/retry')

    expect(result.data).toEqual({ ok: true })
    expect(attempts).toBe(3)
  })

  it('throws after retries are exhausted', async () => {
    let attempts = 0
    const adapter: AxiosAdapter = async (config) => {
      attempts += 1
      throw makeAxiosError(config, 500)
    }

    const client = createHttpClient(undefined, { delayMs: 0, maxRetries: 2, adapter })

    await expect(client.get('/fail')).rejects.toThrow()
    expect(attempts).toBe(3)
  })
})

function makeAxiosError(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, undefined, {
    data: {},
    status,
    statusText: String(status),
    headers: {},
    config
  })
}
