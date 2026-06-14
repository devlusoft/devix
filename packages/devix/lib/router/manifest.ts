export type RouteNode = {
  path: string
  file: string | null
  isIndex: boolean
  isLayout: boolean
  params: string[]
  children: RouteNode[]
}

export type BuildManifestOptions = {
  files: string[]
}

export type BuildManifestResult = {
  routes: RouteNode[]
}

export class ManifestError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ManifestError'
  }
}

type ParsedFile = {
  file: string
  physicalDir: string
  urlSegments: string[]
  isIndex: boolean
  isLayout: boolean
  params: string[]
}

function parseFile(file: string): ParsedFile {
  const parts = file.split('/').filter(Boolean)
  const basename = parts[parts.length - 1]
  const isIndex = basename === 'index.tsx'
  const isLayout = basename === 'layout.tsx'

  const physicalDir = parts.slice(0, -1).join('/')

  const urlSegments: string[] = []
  const params: string[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const isLast = i === parts.length - 1

    if (isLast && (isLayout || isIndex)) continue
    if (part.startsWith('(') && part.endsWith(')')) continue

    if (isLast && part.startsWith('[...') && part.endsWith('].tsx')) {
      const name = part.slice(4, -5)
      urlSegments.push('*')
      params.push(name)
      continue
    }

    if (isLast && part.startsWith('[') && part.endsWith('].tsx')) {
      const name = part.slice(1, -5)
      urlSegments.push(`:${name}`)
      params.push(name)
      continue
    }

    if (part.startsWith('[') && part.endsWith(']')) {
      const isCatchAll = part.startsWith('[...')
      const name = isCatchAll ? part.slice(4, -1) : part.slice(1, -1)
      urlSegments.push(isCatchAll ? '*' : `:${name}`)
      params.push(name)
      continue
    }

    urlSegments.push(part.replace(/\.tsx$/, ''))
  }

  return { file, physicalDir, urlSegments, isIndex, isLayout, params }
}

function relativeUrl(childSegments: string[], parentSegmentCount: number): string {
  const rel = childSegments.slice(parentSegmentCount)
  return rel.length === 0 ? '/' : `/${rel.join('/')}`
}

function getDirectSubdirs(dir: string, allDirs: Set<string>): string[] {
  const prefix = dir === '' ? '' : `${dir}/`
  const subs = new Set<string>()
  for (const d of allDirs) {
    if (d === dir) continue
    if (!d.startsWith(prefix)) continue
    const tail = d.slice(prefix.length)
    const firstSegment = tail.split('/')[0]
    subs.add(prefix + firstSegment)
  }
  return [...subs].sort()
}

function buildForDir(
  dir: string,
  layoutByDir: Map<string, ParsedFile>,
  childrenByDir: Map<string, ParsedFile[]>,
  allDirs: Set<string>,
  parentSegmentCount: number,
): RouteNode[] {
  const layout = layoutByDir.get(dir)
  const leaves = childrenByDir.get(dir) ?? []
  const subdirs = getDirectSubdirs(dir, allDirs)

  const innerParentCount = layout ? layout.urlSegments.length : parentSegmentCount

  const leafNodes: RouteNode[] = leaves.map((p) => ({
    path: relativeUrl(p.urlSegments, innerParentCount),
    file: p.file,
    isIndex: p.isIndex,
    isLayout: false,
    params: p.params,
    children: [],
  }))

  const subResults = subdirs.flatMap((sub) =>
    buildForDir(sub, layoutByDir, childrenByDir, allDirs, innerParentCount),
  )

  if (layout) {
    return [
      {
        path: relativeUrl(layout.urlSegments, parentSegmentCount),
        file: layout.file,
        isIndex: false,
        isLayout: true,
        params: layout.params,
        children: [...leafNodes, ...subResults],
      },
    ]
  }

  return [...leafNodes, ...subResults]
}

function collectAbsoluteUrls(nodes: RouteNode[], parent: string, acc: Map<string, string[]>): void {
  for (const node of nodes) {
    const childUrl = node.path === '/' ? parent : joinUrl(parent, node.path)
    if (!node.isLayout) {
      const list = acc.get(childUrl) ?? []
      if (node.file) list.push(node.file)
      acc.set(childUrl, list)
    }
    if (node.children.length > 0) {
      collectAbsoluteUrls(node.children, node.isLayout ? childUrl : parent, acc)
    }
  }
}

function joinUrl(parent: string, child: string): string {
  if (parent === '/' || parent === '') return child
  if (child === '/') return parent
  return `${parent}${child}`
}

export function buildManifest(options: BuildManifestOptions): BuildManifestResult {
  const parsed = options.files.map(parseFile)

  const layoutByDir = new Map<string, ParsedFile>()
  const childrenByDir = new Map<string, ParsedFile[]>()
  const allDirs = new Set<string>()

  for (const p of parsed) {
    allDirs.add(p.physicalDir)
    let ancestor = p.physicalDir
    while (ancestor !== '') {
      const idx = ancestor.lastIndexOf('/')
      ancestor = idx === -1 ? '' : ancestor.slice(0, idx)
      allDirs.add(ancestor)
    }

    if (p.isLayout) {
      if (layoutByDir.has(p.physicalDir)) {
        throw new ManifestError(
          'MULTIPLE_LAYOUTS',
          `Multiple layout files in "${p.physicalDir}": ${layoutByDir.get(p.physicalDir)?.file}, ${p.file}`,
        )
      }
      layoutByDir.set(p.physicalDir, p)
    } else {
      const list = childrenByDir.get(p.physicalDir) ?? []
      list.push(p)
      childrenByDir.set(p.physicalDir, list)
    }
  }

  const routes = buildForDir('', layoutByDir, childrenByDir, allDirs, 0)

  const urlMap = new Map<string, string[]>()
  collectAbsoluteUrls(routes, '', urlMap)
  for (const [url, files] of urlMap) {
    if (files.length > 1) {
      throw new ManifestError('COLLISION', `Path collision at "${url || '/'}": ${files.join(', ')}`)
    }
  }

  return { routes }
}
