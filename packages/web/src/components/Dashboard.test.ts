import { describe, expect, it } from 'vitest'
import { parseSearchIntent } from './Dashboard'

describe('parseSearchIntent', () => {
  it('turns location phrasing into a structured location filter', () => {
    expect(parseSearchIntent('Company in Dhaka')).toEqual({
      query: '',
      location: 'Dhaka'
    })
  })

  it('keeps ordinary semantic searches as query text', () => {
    expect(parseSearchIntent('AI infrastructure for banks')).toEqual({
      query: 'AI infrastructure for banks',
      location: ''
    })
  })
})
