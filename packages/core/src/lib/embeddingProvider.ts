import type { AxiosInstance } from 'axios'
import { config } from './config'
import { createHttpClient } from './httpClient'

export const EMBEDDING_DIMENSION = 1024

export interface EmbeddingProvider {
  readonly model: string
  embed(text: string): Promise<number[]>
  embedMany?(texts: string[]): Promise<number[][]>
}

interface VoyageEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>
}

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly model: string
  private readonly client: AxiosInstance

  constructor(options: { apiKey?: string; model?: string; client?: AxiosInstance } = {}) {
    this.model = options.model ?? 'voyage-3.5'
    this.client = options.client ?? createHttpClient('https://api.voyageai.com/v1', { maxRetries: 6 })
    this.apiKey = options.apiKey ?? config.VOYAGE_API_KEY
  }

  private readonly apiKey: string

  async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedMany([text])
    if (!embedding) {
      throw new Error('Voyage embeddings response did not include an embedding')
    }
    return embedding
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('VOYAGE_API_KEY is required to generate embeddings')
    }

    if (texts.length === 0) return []

    const response = await this.client.post<VoyageEmbeddingResponse>(
      '/embeddings',
      {
        model: this.model,
        input: texts
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const embeddings = response.data.data?.map((item) => item.embedding)
    if (!embeddings || embeddings.length !== texts.length || embeddings.some((embedding) => !embedding?.length)) {
      throw new Error('Voyage embeddings response did not include an embedding')
    }

    const validEmbeddings = embeddings as number[][]
    for (const embedding of validEmbeddings) {
      if (embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error(`Expected Voyage embedding dimension ${EMBEDDING_DIMENSION}, received ${embedding.length}`)
      }
    }

    return validEmbeddings
  }
}
