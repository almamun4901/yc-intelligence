const API_BASE_URL = process.env.YC_INTELLIGENCE_API_URL ?? 'http://localhost:3001'

type RouteContext = {
  params: Promise<{
    path: string[]
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params
  const upstreamUrl = new URL(path.join('/'), `${API_BASE_URL}/`)
  upstreamUrl.search = new URL(request.url).search

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        accept: 'application/json'
      },
      cache: 'no-store'
    })
    const contentType = upstream.headers.get('content-type') ?? 'application/json'
    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': contentType
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown API proxy error'

    return Response.json(
      {
        error: 'API unavailable',
        message,
        upstream: upstreamUrl.toString()
      },
      { status: 502 }
    )
  }
}
