'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type View = 'companies' | 'jobs'
type NavKey = 'search' | 'companies' | 'jobs' | 'hn' | 'pipeline' | 'saved'
type StatusFilter = 'All' | 'Active' | 'Acquired' | 'Inactive'
type LoadState = 'idle' | 'loading' | 'success' | 'error'

interface CompanySummary {
  name: string
  slug: string
  score?: number
  batch: string | null
  status: string | null
  shortDescription: string | null
  website: string | null
  teamSize: string | number | null
  isHiring: boolean
  tags: string[]
  location: string | null
}

interface CompanyDetail extends CompanySummary {
  description: string | null
  founders: Array<{
    name: string
    linkedinUrl: string | null
    previousEmployers: string[]
    schools: string[]
  }>
  hnPosts: Array<{
    title: string
    url: string | null
    author: string | null
    points: number | null
    comments: number | null
    postType: string | null
    postedAt: string
  }>
  updatedAt: string
}

interface JobSummary {
  id: string
  companyId: string
  title: string
  location: string | null
  isRemote: boolean
  techStack: string[]
  atsSource: string | null
  applyUrl: string | null
  isActive: boolean
  postedAt: string | null
  fetchedAt: string
}

interface CompanySearchResponse {
  total: number
  count: number
  companies: CompanySummary[]
}

interface JobSearchResponse {
  total: number
  count: number
  jobs: JobSummary[]
}

interface CompanyDetailResponse {
  found: boolean
  company?: CompanyDetail
  message?: string
}

const navItems: Array<{ key: NavKey; label: string; view: View | 'static' }> = [
  { key: 'search', label: 'Search', view: 'companies' },
  { key: 'companies', label: 'Companies', view: 'companies' },
  { key: 'jobs', label: 'Jobs', view: 'jobs' },
  { key: 'hn', label: 'HN Activity', view: 'static' },
  { key: 'pipeline', label: 'Pipeline', view: 'static' },
  { key: 'saved', label: 'Saved Searches', view: 'static' }
]

const statusFilters: StatusFilter[] = ['All', 'Active', 'Acquired', 'Inactive']

export function Dashboard() {
  const [view, setView] = useState<View>('companies')
  const [activeNav, setActiveNav] = useState<NavKey>('search')
  const [queryInput, setQueryInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [batch, setBatch] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [techInput, setTechInput] = useState('')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [isHiring, setIsHiring] = useState(false)
  const [isRemote, setIsRemote] = useState(false)
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [companyTotal, setCompanyTotal] = useState(0)
  const [hiringCompanyTotal, setHiringCompanyTotal] = useState(0)
  const [jobTotal, setJobTotal] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetail | null>(null)
  const [detailState, setDetailState] = useState<LoadState>('idle')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const techStack = useMemo(
    () =>
      techInput
        .split(',')
        .map((tech) => tech.trim())
        .filter(Boolean),
    [techInput]
  )

  const activeFilters = [
    batch,
    industry,
    location,
    status !== 'All' ? status : '',
    isHiring ? 'Hiring' : '',
    isRemote ? 'Remote' : ''
  ]
    .filter(Boolean)
    .length

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoadState('loading')
      setError(null)

      try {
        if (view === 'jobs') {
          const data = await fetchJobs({ batch, industry, isRemote, techStack, query: submittedQuery }, controller.signal)
          setJobs(data.jobs)
          setJobTotal(data.total)
        } else {
          const [data, hiringData] = await Promise.all([
            fetchCompanies({ batch, industry, isHiring, location, query: submittedQuery, status }, controller.signal),
            fetchHiringCompanyCount(controller.signal)
          ])
          setCompanies(data.companies)
          setCompanyTotal(data.total)
          setHiringCompanyTotal(hiringData.total)
        }

        setLoadState('success')
        setLastRefresh(new Date())
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoadState('error')
      }
    }

    void load()

    return () => controller.abort()
  }, [batch, industry, isHiring, isRemote, location, status, submittedQuery, techStack, view])

  useEffect(() => {
    if (!selectedSlug) {
      setSelectedCompany(null)
      setDetailState('idle')
      return
    }

    const controller = new AbortController()

    async function loadDetail() {
      setDetailState('loading')
      try {
        const response = await apiGet<CompanyDetailResponse>(`/api/companies/${selectedSlug}`, controller.signal)
        if (!response.found || !response.company) throw new Error(response.message ?? 'Company detail not found')
        setSelectedCompany(response.company)
        setDetailState('success')
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load company detail')
        setDetailState('error')
      }
    }

    void loadDetail()

    return () => controller.abort()
  }, [selectedSlug])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const intent = parseSearchIntent(queryInput)
    setSubmittedQuery(intent.query)
    if (intent.location) setLocation(intent.location)
  }

  function resetFilters() {
    setBatch('')
    setIndustry('')
    setLocation('')
    setTechInput('')
    setStatus('All')
    setIsHiring(false)
    setIsRemote(false)
    setSubmittedQuery('')
    setQueryInput('')
  }

  const metricItems = [
    { label: 'Indexed companies', value: formatCount(companyTotal), detail: `${companies.length} loaded` },
    { label: 'Actively hiring', value: formatCount(hiringCompanyTotal), detail: 'Dataset total' },
    { label: 'Open jobs', value: formatCount(jobTotal), detail: `${jobs.length} loaded` },
    { label: 'Active filters', value: String(activeFilters), detail: submittedQuery ? 'Semantic query on' : 'Structured search' },
    { label: 'Last refresh', value: lastRefresh ? formatTime(lastRefresh) : '-', detail: loadState === 'loading' ? 'Loading' : 'Live API' }
  ]

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark">YC</span>
          <span>Intelligence</span>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              className={activeNav === item.key ? 'nav-item active' : 'nav-item'}
              disabled={item.view === 'static'}
              key={item.key}
              onClick={() => {
                if (item.view === 'static') return
                setActiveNav(item.key)
                setView(item.view)
              }}
              type="button"
            >
              <span className="nav-icon" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" type="button">
            Settings
          </button>
          <button className="nav-item" type="button">
            Sign out
          </button>
        </div>
      </aside>

      <section className="workspace" aria-label="YC Intelligence research cockpit">
        <header className="topbar">
          <form className="command-search" onSubmit={submitSearch}>
            <span aria-hidden="true">Search</span>
            <input
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder={
                view === 'jobs'
                  ? 'Search job titles - backend, platform, founding engineer...'
                  : 'Ask anything - companies hiring Rust engineers in Berlin, AI infra from W24...'
              }
              value={queryInput}
            />
            <kbd>Enter</kbd>
          </form>
          <div className="topbar-actions">
            <span>{loadState === 'loading' ? 'Refreshing...' : `Last refresh: ${lastRefresh ? formatTime(lastRefresh) : '-'}`}</span>
            <button
              aria-label="Refresh data"
              className="icon-button"
              onClick={() => {
                const intent = parseSearchIntent(queryInput)
                setSubmittedQuery(intent.query)
                if (intent.location) setLocation(intent.location)
              }}
              type="button"
            >
              R
            </button>
            <span className="avatar">JD</span>
          </div>
        </header>

        <section className="metric-strip" aria-label="Dataset metrics">
          {metricItems.map((metric) => (
            <article className="metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </section>

        <section className="filters" aria-label="Search filters">
          <input aria-label="Batch" onChange={(event) => setBatch(event.target.value)} placeholder="Batch..." value={batch} />
          <input
            aria-label="Industry"
            onChange={(event) => setIndustry(event.target.value)}
            placeholder="Industry..."
            value={industry}
          />
          {view === 'companies' ? (
            <div className="segmented" aria-label="Company status">
              {statusFilters.map((option) => (
                <button
                  className={status === option ? 'selected' : ''}
                  key={option}
                  onClick={() => setStatus(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
          <button className={isHiring ? 'pill active-pill' : 'pill'} onClick={() => setIsHiring((value) => !value)} type="button">
            Hiring
          </button>
          <button className={isRemote ? 'pill active-pill' : 'pill'} onClick={() => setIsRemote((value) => !value)} type="button">
            Remote
          </button>
          <input
            aria-label="Technology stack"
            onChange={(event) => setTechInput(event.target.value)}
            placeholder="Tech stack..."
            value={techInput}
          />
          <input aria-label="Location" onChange={(event) => setLocation(event.target.value)} placeholder="Location..." value={location} />
          <button className="link-button" onClick={resetFilters} type="button">
            Reset
          </button>
        </section>

        {error ? <div className="notice error-notice">{error}</div> : null}
        <div className="content-grid">
          <section className="results-panel" aria-label={view === 'jobs' ? 'Job results' : 'Company results'}>
            <div className="results-header">
              <span>{loadState === 'loading' ? 'Loading' : `${formatCount(view === 'jobs' ? jobTotal : companyTotal)} results`}</span>
              <strong>{view === 'jobs' ? 'Open YC jobs' : submittedQuery ? 'Semantic company search' : 'Company directory'}</strong>
            </div>
            {view === 'jobs' ? (
              <JobsTable jobs={jobs} loading={loadState === 'loading'} />
            ) : (
              <CompaniesTable
                companies={companies}
                loading={loadState === 'loading'}
                onSelect={setSelectedSlug}
                selectedSlug={selectedSlug}
              />
            )}
          </section>

          <CompanyInspector company={selectedCompany} loading={detailState === 'loading'} />
        </div>
      </section>
    </main>
  )
}

function CompaniesTable({
  companies,
  loading,
  onSelect,
  selectedSlug
}: {
  companies: CompanySummary[]
  loading: boolean
  onSelect: (slug: string) => void
  selectedSlug: string | null
}) {
  if (!loading && companies.length === 0) return <EmptyState label="No companies match the current filters." />

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Status</th>
            <th>Tags</th>
            <th>Location</th>
            <th>Team</th>
            <th>Hiring</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr className={selectedSlug === company.slug ? 'selected-row' : ''} key={company.slug}>
              <td>
                <button className="company-cell row-button" onClick={() => onSelect(company.slug)} type="button">
                  <span>
                    <strong>{company.name}</strong>
                    <small>{company.batch ?? '-'}</small>
                  </span>
                </button>
              </td>
              <td>
                <span className={company.status === 'Active' ? 'status active-status' : 'status'}>{company.status ?? '-'}</span>
              </td>
              <td>
                <TagRow tags={company.tags} />
              </td>
              <td>{company.location ?? '-'}</td>
              <td>{company.teamSize ?? '-'}</td>
              <td>{company.isHiring ? <span className="hiring">Hiring</span> : '-'}</td>
              <td>{company.score?.toFixed(2) ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JobsTable({ jobs, loading }: { jobs: JobSummary[]; loading: boolean }) {
  if (!loading && jobs.length === 0) return <EmptyState label="No jobs match the current filters." />

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Location</th>
            <th>Remote</th>
            <th>Tech</th>
            <th>ATS</th>
            <th>Posted</th>
            <th>Apply</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>
                <strong>{job.title}</strong>
              </td>
              <td>{job.location ?? '-'}</td>
              <td>{job.isRemote ? <span className="hiring">Remote</span> : '-'}</td>
              <td>
                <TagRow tags={job.techStack} />
              </td>
              <td>{job.atsSource ?? '-'}</td>
              <td>{job.postedAt ? new Date(job.postedAt).toLocaleDateString() : '-'}</td>
              <td>
                {job.applyUrl ? (
                  <a className="table-link" href={job.applyUrl} rel="noreferrer" target="_blank">
                    Open
                  </a>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompanyInspector({ company, loading }: { company: CompanyDetail | null; loading: boolean }) {
  if (loading) {
    return (
      <aside className="inspector" aria-label="Company inspector">
        <div className="inspector-empty">
          <span aria-hidden="true" />
          <strong>Loading company...</strong>
        </div>
      </aside>
    )
  }

  if (!company) {
    return (
      <aside className="inspector" aria-label="Company inspector">
        <div className="inspector-empty">
          <span aria-hidden="true" />
          <strong>Select a company to inspect</strong>
          <p>Founder history, job velocity, HN launches, and semantic matches appear here.</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="inspector inspector-detail" aria-label="Company inspector">
      <div>
        <span className="eyebrow">{company.batch ?? 'YC'}</span>
        <h2>{company.name}</h2>
        <p>{company.description ?? company.shortDescription ?? 'No description available.'}</p>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Status</dt>
          <dd>{company.status ?? '-'}</dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>{company.teamSize ?? '-'}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{company.location ?? '-'}</dd>
        </div>
        <div>
          <dt>Hiring</dt>
          <dd>{company.isHiring ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <TagRow tags={company.tags} />
      <section>
        <h3>Founders</h3>
        {company.founders.length ? (
          <ul className="plain-list">
            {company.founders.map((founder) => (
              <li key={founder.name}>{founder.name}</li>
            ))}
          </ul>
        ) : (
          <p>No founder records returned.</p>
        )}
      </section>
      <section>
        <h3>HN Activity</h3>
        {company.hnPosts.length ? (
          <ul className="plain-list">
            {company.hnPosts.slice(0, 3).map((post) => (
              <li key={`${post.title}-${post.postedAt}`}>{post.title}</li>
            ))}
          </ul>
        ) : (
          <p>No HN posts returned.</p>
        )}
      </section>
      {company.website ? (
        <a className="primary-link" href={company.website} rel="noreferrer" target="_blank">
          Open website
        </a>
      ) : null}
    </aside>
  )
}

function TagRow({ tags }: { tags: string[] }) {
  if (!tags.length) return <span>-</span>

  return (
    <div className="tag-row">
      {tags.slice(0, 3).map((tag) => (
        <span className="tag" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>
}

async function fetchCompanies(
  filters: {
    batch: string
    industry: string
    isHiring: boolean
    location: string
    query: string
    status: StatusFilter
  },
  signal: AbortSignal
) {
  const params = new URLSearchParams({ limit: '25' })
  if (filters.batch) params.set('batch', filters.batch)
  if (filters.industry) params.set('industry', filters.industry)
  if (filters.location) params.set('location', filters.location)
  if (filters.isHiring) params.set('isHiring', 'true')
  if (filters.status !== 'All') params.set('status', filters.status)
  if (filters.query) params.set('query', filters.query)

  const path = filters.query ? '/api/search/semantic' : '/api/companies'
  return apiGet<CompanySearchResponse>(`${path}?${params.toString()}`, signal)
}

async function fetchHiringCompanyCount(signal: AbortSignal) {
  return apiGet<CompanySearchResponse>('/api/companies?isHiring=true&limit=0', signal)
}

async function fetchJobs(
  filters: {
    batch: string
    industry: string
    isRemote: boolean
    query: string
    techStack: string[]
  },
  signal: AbortSignal
) {
  const params = new URLSearchParams({ limit: '25' })
  if (filters.batch) params.set('batch', filters.batch)
  if (filters.industry) params.set('industry', filters.industry)
  if (filters.isRemote) params.set('isRemote', 'true')
  if (filters.query) params.set('title', filters.query)
  if (filters.techStack.length) params.set('techStack', filters.techStack.join(','))

  return apiGet<JobSearchResponse>(`/api/jobs?${params.toString()}`, signal)
}

async function apiGet<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  const payload = (await response.json()) as T & { error?: string; message?: string }

  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? `Request failed with ${response.status}`)
  }

  return payload
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatTime(value: Date) {
  return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function parseSearchIntent(raw: string): { query: string; location: string } {
  const trimmed = raw.trim()
  const locationMatch = trimmed.match(/^(?:company|companies|startup|startups)?\s*(?:in|near|from|based in)\s+(.+)$/i)
  if (!locationMatch) return { query: trimmed, location: '' }

  return {
    query: '',
    location: cleanupLocation(locationMatch[1] ?? '')
  }
}

function cleanupLocation(value: string) {
  return value.replace(/[?.!,]+$/g, '').trim()
}
