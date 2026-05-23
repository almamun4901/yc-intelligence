import pino from 'pino'
import { config } from './config'

export const createLogger = (name: string) =>
  pino({
    name,
    level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined
  })
