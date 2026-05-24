import { describe, expect, it } from 'vitest'
import { extractTechStack } from '../techExtractor'

describe('extractTechStack', () => {
  it('normalizes casing and aliases', () => {
    expect(extractTechStack('We use TypeScript, TS, Node.js, Postgres, and Golang.')).toEqual([
      'go',
      'nodejs',
      'postgresql',
      'typescript'
    ])
  })

  it('extracts multi-word technology names', () => {
    expect(extractTechStack('Experience with Ruby on Rails and Amazon Web Services is useful.')).toEqual([
      'aws',
      'rails'
    ])
  })

  it('does not match short aliases inside longer words', () => {
    expect(extractTechStack('You will undergo onboarding and design gorgeous products.')).toEqual([])
  })

  it('deduplicates canonical technology names', () => {
    expect(extractTechStack('React, react.js, ReactJS, PostgreSQL, postgres')).toEqual(['postgresql', 'react'])
  })

  it('returns an empty list for empty descriptions', () => {
    expect(extractTechStack('   ')).toEqual([])
  })
})
