'use client'

import { FormEvent, UIEvent, useEffect, useMemo, useRef, useState } from 'react'

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
const PAGE_SIZE = 50
const LOAD_MORE_THRESHOLD_PX = 160

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
  const [isLoadingMore, setIsLoadingMore] = useState(false)
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

  const pageKey = useMemo(
    () =>
      JSON.stringify({
        batch,
        industry,
        isHiring,
        isRemote,
        location,
        status,
        submittedQuery,
        techStack,
        view
      }),
    [batch, industry, isHiring, isRemote, location, status, submittedQuery, techStack, view]
  )
  const activePageKeyRef = useRef(pageKey)

  useEffect(() => {
    const controller = new AbortController()
    activePageKeyRef.current = pageKey

    async function load() {
      setLoadState('loading')
      setIsLoadingMore(false)
      setError(null)

      try {
        if (view === 'jobs') {
          const data = await fetchJobs(
            { batch, industry, isRemote, limit: PAGE_SIZE, offset: 0, techStack, query: submittedQuery },
            controller.signal
          )
          setJobs(data.jobs)
          setJobTotal(data.total)
        } else {
          const [data, hiringData] = await Promise.all([
            fetchCompanies(
              { batch, industry, isHiring, limit: PAGE_SIZE, location, offset: 0, query: submittedQuery, status },
              controller.signal
            ),
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
  }, [batch, industry, isHiring, isRemote, location, pageKey, status, submittedQuery, techStack, view])

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

  async function loadMoreResults() {
    if (loadState === 'loading' || isLoadingMore) return

    const offset = view === 'jobs' ? jobs.length : companies.length
    const total = view === 'jobs' ? jobTotal : companyTotal
    if (offset >= total) return

    const loadKey = pageKey
    const controller = new AbortController()
    setIsLoadingMore(true)
    setError(null)

    try {
      if (view === 'jobs') {
        const data = await fetchJobs(
          { batch, industry, isRemote, limit: PAGE_SIZE, offset, techStack, query: submittedQuery },
          controller.signal
        )
        if (activePageKeyRef.current !== loadKey) return
        setJobs((current) => mergeByKey(current, data.jobs, (job) => job.id))
        setJobTotal(data.total)
      } else {
        const data = await fetchCompanies(
          { batch, industry, isHiring, limit: PAGE_SIZE, location, offset, query: submittedQuery, status },
          controller.signal
        )
        if (activePageKeyRef.current !== loadKey) return
        setCompanies((current) => mergeByKey(current, data.companies, (company) => company.slug))
        setCompanyTotal(data.total)
      }
      setLastRefresh(new Date())
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load more results')
    } finally {
      if (activePageKeyRef.current === loadKey) setIsLoadingMore(false)
    }
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
          <div className="topbar-heading">
            <span className="eyebrow">Research cockpit</span>
            <h1>YC company intelligence</h1>
          </div>
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
              <JobsTable
                hasMore={jobs.length < jobTotal}
                jobs={jobs}
                loading={loadState === 'loading'}
                loadingMore={isLoadingMore}
                onLoadMore={loadMoreResults}
              />
            ) : (
              <CompaniesTable
                companies={companies}
                hasMore={companies.length < companyTotal}
                loading={loadState === 'loading'}
                loadingMore={isLoadingMore}
                onLoadMore={loadMoreResults}
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
  hasMore,
  loading,
  loadingMore,
  onLoadMore,
  onSelect,
  selectedSlug
}: {
  companies: CompanySummary[]
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onSelect: (slug: string) => void
  selectedSlug: string | null
}) {
  if (!loading && companies.length === 0) return <EmptyState label="No companies match the current filters." />

  return (
    <div className="table-wrap" onScroll={(event) => handleResultsScroll(event, hasMore, loadingMore, onLoadMore)}>
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
      <InfiniteScrollStatus hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} />
    </div>
  )
}

function JobsTable({
  hasMore,
  jobs,
  loading,
  loadingMore,
  onLoadMore
}: {
  hasMore: boolean
  jobs: JobSummary[]
  loading: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  if (!loading && jobs.length === 0) return <EmptyState label="No jobs match the current filters." />

  return (
    <div className="table-wrap" onScroll={(event) => handleResultsScroll(event, hasMore, loadingMore, onLoadMore)}>
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
      <InfiniteScrollStatus hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} />
    </div>
  )
}

function InfiniteScrollStatus({
  hasMore,
  loadingMore,
  onLoadMore
}: {
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  if (!hasMore) return <div className="load-more-status">All matching rows loaded</div>

  return (
    <div className="load-more-status">
      {loadingMore ? (
        <span>Loading more...</span>
      ) : (
        <button onClick={onLoadMore} type="button">
          Load more
        </button>
      )}
    </div>
  )
}

function handleResultsScroll(
  event: UIEvent<HTMLDivElement>,
  hasMore: boolean,
  loadingMore: boolean,
  onLoadMore: () => void
) {
  if (!hasMore || loadingMore) return

  const target = event.currentTarget
  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  if (distanceToBottom <= LOAD_MORE_THRESHOLD_PX) onLoadMore()
}

function CompanyInspector({ company, loading }: { company: CompanyDetail | null; loading: boolean }) {
  if (loading) {
    return (
      <aside className="inspector" aria-label="Company inspector">
        <div className="inspector-empty">
          <span className="inspector-empty-mark loading-mark" aria-hidden="true" />
          <strong>Loading company...</strong>
          <p>Pulling the full company profile, founder rows, and HN activity.</p>
        </div>
      </aside>
    )
  }

  if (!company) {
    return (
      <aside className="inspector" aria-label="Company inspector">
        <div className="inspector-empty">
          <span className="inspector-empty-mark" aria-hidden="true" />
          <strong>Select a company to inspect</strong>
          <p>Founder history, job velocity, HN launches, and semantic matches appear here.</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="inspector inspector-detail" aria-label="Company inspector">
      <header className="inspector-hero">
        <div className="company-avatar" aria-hidden="true">
          {company.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="inspector-title">
          <div className="inspector-kicker">
            <span>{company.batch ?? 'YC'}</span>
            <span className={company.status === 'Active' ? 'status active-status' : 'status'}>{company.status ?? 'Unknown'}</span>
          </div>
          <h2>{company.name}</h2>
          <p>{company.description ?? company.shortDescription ?? 'No description available.'}</p>
        </div>
        {company.website ? (
          <a className="icon-link" href={company.website} rel="noreferrer" target="_blank" aria-label={`Open ${company.name} website`}>
            Open
          </a>
        ) : null}
      </header>

      <dl className="detail-grid">
        <div>
          <dt>Team</dt>
          <dd>{company.teamSize ?? '-'}</dd>
        </div>
        <div>
          <dt>Hiring</dt>
          <dd className={company.isHiring ? 'positive-value' : ''}>{company.isHiring ? 'Open roles' : 'Not listed'}</dd>
        </div>
        <div className="wide-detail">
          <dt>Location</dt>
          <dd>{company.location ?? '-'}</dd>
        </div>
        <div className="wide-detail">
          <dt>Updated</dt>
          <dd>{formatDate(company.updatedAt)}</dd>
        </div>
      </dl>

      <section className="inspector-section">
        <div className="section-heading">
          <h3>Signals</h3>
          <span>{company.tags.length ? `${company.tags.length} tags` : 'No tags'}</span>
        </div>
        <TagRow tags={company.tags} />
      </section>

      <section className="inspector-section">
        <div className="section-heading">
          <h3>Founders</h3>
          <span>{company.founders.length || 'None'}</span>
        </div>
        {company.founders.length ? (
          <ul className="entity-list">
            {company.founders.map((founder) => (
              <li key={founder.name}>
                <span className="entity-dot" aria-hidden="true" />
                <div>
                  <strong>{founder.name}</strong>
                  <small>{summarizeFounder(founder)}</small>
                </div>
                {founder.linkedinUrl ? (
                  <a href={founder.linkedinUrl} rel="noreferrer" target="_blank" aria-label={`Open ${founder.name} LinkedIn`}>
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="subtle-copy">No founder records returned.</p>
        )}
      </section>

      <section className="inspector-section">
        <div className="section-heading">
          <h3>HN Activity</h3>
          <span>{company.hnPosts.length ? `Top ${Math.min(company.hnPosts.length, 3)}` : 'Quiet'}</span>
        </div>
        {company.hnPosts.length ? (
          <ul className="activity-list">
            {company.hnPosts.slice(0, 3).map((post) => (
              <li key={`${post.title}-${post.postedAt}`}>
                {post.url ? (
                  <a href={post.url} rel="noreferrer" target="_blank">
                    {post.title}
                  </a>
                ) : (
                  <strong>{post.title}</strong>
                )}
                <span>
                  {post.points ?? 0} pts / {post.comments ?? 0} comments / {formatDate(post.postedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="subtle-copy">No HN posts returned.</p>
        )}
      </section>

      {company.website ? (
        <a className="primary-link" href={company.website} rel="noreferrer" target="_blank">
          Open {formatHost(company.website)}
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
    limit: number
    location: string
    offset: number
    query: string
    status: StatusFilter
  },
  signal: AbortSignal
) {
  const params = new URLSearchParams({ limit: String(filters.limit), offset: String(filters.offset) })
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
    limit: number
    offset: number
    query: string
    techStack: string[]
  },
  signal: AbortSignal
) {
  const params = new URLSearchParams({ limit: String(filters.limit), offset: String(filters.offset) })
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return 'website'
  }
}

function summarizeFounder(founder: CompanyDetail['founders'][number]) {
  const details = [...founder.previousEmployers, ...founder.schools].filter(Boolean)
  return details.length ? details.slice(0, 2).join(' / ') : 'Founder profile'
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

function mergeByKey<T>(current: T[], incoming: T[], getKey: (item: T) => string) {
  const seen = new Set(current.map(getKey))
  const merged = [...current]
  for (const item of incoming) {
    const key = getKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}
