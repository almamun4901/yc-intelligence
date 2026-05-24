const TECH_KEYWORDS: Record<string, string> = {
  'amazon web services': 'aws',
  aws: 'aws',
  azure: 'azure',
  docker: 'docker',
  elasticsearch: 'elasticsearch',
  gcp: 'gcp',
  go: 'go',
  golang: 'go',
  graphql: 'graphql',
  grpc: 'grpc',
  javascript: 'javascript',
  js: 'javascript',
  kafka: 'kafka',
  k8s: 'kubernetes',
  kubernetes: 'kubernetes',
  mongodb: 'mongodb',
  mysql: 'mysql',
  nextjs: 'nextjs',
  'next.js': 'nextjs',
  node: 'nodejs',
  nodejs: 'nodejs',
  'node.js': 'nodejs',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  py: 'python',
  python: 'python',
  rails: 'rails',
  react: 'react',
  'react.js': 'react',
  reactjs: 'react',
  redis: 'redis',
  ruby: 'ruby',
  'ruby on rails': 'rails',
  rust: 'rust',
  terraform: 'terraform',
  ts: 'typescript',
  typescript: 'typescript'
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const TECH_PATTERN = new RegExp(
  `(?<![a-z0-9])(${Object.keys(TECH_KEYWORDS).sort((a, b) => b.length - a.length).map(escapeRegex).join('|')})(?![a-z0-9])`,
  'gi'
)

export const extractTechStack = (description: string): string[] => {
  if (!description.trim()) return []

  const found = new Set<string>()
  for (const match of description.matchAll(TECH_PATTERN)) {
    const canonical = TECH_KEYWORDS[match[1].toLowerCase()]
    if (canonical) found.add(canonical)
  }

  return Array.from(found).sort()
}
