import { describe, expect, it } from 'vitest'
import { YCTransformer } from '../YCTransformer'

describe('YCTransformer', () => {
  const transformer = new YCTransformer()

  it('maps a complete YC company fixture', () => {
    const company = transformer.toCompany({
      name: 'Acme AI',
      slug: 'acme-ai',
      batch: 'W24',
      status: 'Acquired',
      long_description: 'Builds AI for forms.',
      one_liner: 'AI paperwork automation.',
      website: 'https://acme.ai',
      team_size: 42,
      is_hiring: true,
      tags: ['AI', 'B2B'],
      location: 'San Francisco'
    })

    expect(company).toMatchObject({
      name: 'Acme AI',
      slug: 'acme-ai',
      batch: 'W24',
      status: 'Acquired',
      description: 'Builds AI for forms.',
      shortDescription: 'AI paperwork automation.',
      website: 'https://acme.ai',
      teamSize: '11-50',
      isHiring: true,
      tags: ['AI', 'B2B'],
      location: 'San Francisco'
    })
  })

  it('handles missing optional fields', () => {
    const company = transformer.toCompany({
      name: 'Minimal Co',
      slug: 'minimal-co'
    })

    expect(company).toMatchObject({
      name: 'Minimal Co',
      slug: 'minimal-co',
      batch: null,
      status: 'Active',
      description: null,
      shortDescription: null,
      website: null,
      teamSize: null,
      isHiring: false,
      tags: [],
      location: null
    })
  })

  it('maps the live YC API camelCase shape', () => {
    const company = transformer.toCompany({
      id: 32194,
      name: 'GUILD',
      slug: 'guild',
      website: 'https://www.guildai.co',
      oneLiner: 'Neoprime Reshaping Defense Supply Chain',
      longDescription: 'Modern tooling for defense manufacturing.',
      teamSize: 2,
      batch: 'S26',
      tags: ['GovTech', 'Compliance', 'AI'],
      status: 'Active',
      industries: ['Industrials', 'Defense', 'AI'],
      locations: ['New York, NY, USA']
    })

    expect(company).toMatchObject({
      name: 'GUILD',
      slug: 'guild',
      batch: 'S26',
      status: 'Active',
      description: 'Modern tooling for defense manufacturing.',
      shortDescription: 'Neoprime Reshaping Defense Supply Chain',
      website: 'https://www.guildai.co',
      teamSize: '1-10',
      isHiring: false,
      tags: ['GovTech', 'Compliance', 'AI', 'Industrials', 'Defense'],
      location: 'New York, NY, USA'
    })
  })

  it('normalizes known and unknown statuses', () => {
    expect(transformer.toCompany({ name: 'Dead Co', slug: 'dead-co', status: 'Dead' }).status).toBe(
      'Dead'
    )
    expect(
      transformer.toCompany({ name: 'Public Co', slug: 'public-co', status: 'Public' }).status
    ).toBe('Active')
  })

  it('maps founders and ignores blank names', () => {
    const founders = transformer.toFounders(
      {
        founders: [
          { full_name: 'Ada Lovelace', linkedin_url: 'https://linkedin.com/in/ada' },
          { full_name: ' ' },
          { name: 'Grace Hopper' },
          { full_name: 'Ada Lovelace', linkedin_url: 'https://linkedin.com/in/ada-new' }
        ]
      },
      'company-1'
    )

    expect(founders).toEqual([
      {
        companyId: 'company-1',
        name: 'Ada Lovelace',
        linkedinUrl: 'https://linkedin.com/in/ada-new',
        previousEmployers: [],
        schools: []
      },
      {
        companyId: 'company-1',
        name: 'Grace Hopper',
        linkedinUrl: null,
        previousEmployers: [],
        schools: []
      }
    ])
  })
})
