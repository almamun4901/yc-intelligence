import type { AxiosInstance } from 'axios'
import { config } from './config'
import { createHttpClient } from './httpClient'

export interface EmbeddingProvider {
  readonly model: string
  embed(text: string): Promise<number[]>
}

interface OpenAIEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly model: string
  private readonly client: AxiosInstance

  constructor(options: { apiKey?: string; model?: string; client?: AxiosInstance } = {}) {
    this.model = options.model ?? 'text-embedding-3-small'
    this.client = options.client ?? createHttpClient('https://api.openai.com/v1')
    this.apiKey = options.apiKey ?? config.OPENAI_API_KEY
  }

  private readonly apiKey: string

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required to generate embeddings')
    }

    const response = await this.client.post<OpenAIEmbeddingResponse>(
      '/embeddings',
      {
        model: this.model,
        input: text
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const embedding = response.data.data?.[0]?.embedding
    if (!embedding || embedding.length === 0) {
      throw new Error('OpenAI embeddings response did not include an embedding')
    }

    return embedding
  }
}
