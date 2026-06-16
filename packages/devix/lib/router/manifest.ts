export type RouteNode = {
  path: string
  file: string | null
  isIndex: boolean
  isLayout: boolean
  middlewares: string[]
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
  middlewareByDir: Map<string, string>,
  allDirs: Set<string>,
  parentSegmentCount: number,
  parentMiddlewares: string[],
): RouteNode[] {
  const layout = layoutByDir.get(dir)
  const leaves = childrenByDir.get(dir) ?? []
  const subdirs = getDirectSubdirs(dir, allDirs)

  const dirMiddleware = middlewareByDir.get(dir)
  const currentMiddlewares = dirMiddleware
    ? [...parentMiddlewares, dirMiddleware]
    : parentMiddlewares

  const innerParentCount = layout ? layout.urlSegments.length : parentSegmentCount

  const leafNodes: RouteNode[] = leaves.map((p) => ({
    path: relativeUrl(p.urlSegments, innerParentCount),
    file: p.file,
    isIndex: p.isIndex,
    isLayout: false,
    middlewares: currentMiddlewares,
    params: p.params,
    children: [],
  }))

  const subResults = subdirs.flatMap((sub) =>
    buildForDir(
      sub,
      layoutByDir,
      childrenByDir,
      middlewareByDir,
      allDirs,
      innerParentCount,
      currentMiddlewares,
    ),
  )

  if (layout) {
    return [
      {
        path: relativeUrl(layout.urlSegments, parentSegmentCount),
        file: layout.file,
        isIndex: false,
        isLayout: true,
        middlewares: currentMiddlewares,
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

type MatchNodeResult = {
  consumed: number
  params: Record<string, string>
}

function matchNodePath(path: string, parts: string[]): MatchNodeResult | null {
  if (path === '/') {
    return { consumed: 0, params: {} }
  }

  const nodeParts = path.split('/').filter(Boolean)
  if (nodeParts.length > parts.length) {
    return null
  }

  const params: Record<string, string> = {}
  for (let i = 0; i < nodeParts.length; i++) {
    const part = nodeParts[i]
    if (part.startsWith(':')) {
      params[part.slice(1)] = parts[i]
    } else if (part === '*') {
      return { consumed: parts.length, params }
    } else if (part !== parts[i]) {
      return null
    }
  }

  return { consumed: nodeParts.length, params }
}

export type RouteMatch = {
  leaf: RouteNode
  layouts: RouteNode[]
  params: Record<string, string>
}

export function findRouteForUrl(nodes: RouteNode[], urlPath: string): RouteMatch | null {
  const parts = urlPath.split('/').filter(Boolean)

  function match(nodesToMatch: RouteNode[], remainingParts: string[]): RouteMatch | null {
    for (const node of nodesToMatch) {
      const nodeMatch = matchNodePath(node.path, remainingParts)
      if (!nodeMatch) continue

      if (node.isLayout) {
        const childResult = match(node.children, remainingParts.slice(nodeMatch.consumed))
        if (childResult) {
          return {
            leaf: childResult.leaf,
            layouts: [node, ...childResult.layouts],
            params: { ...nodeMatch.params, ...childResult.params },
          }
        }
      } else if (remainingParts.length === nodeMatch.consumed) {
        return { leaf: node, layouts: [], params: nodeMatch.params }
      }
    }
    return null
  }

  return match(nodes, parts)
}

export function buildManifest(options: BuildManifestOptions): BuildManifestResult {
  const parsed = options.files.map(parseFile)

  const layoutByDir = new Map<string, ParsedFile>()
  const childrenByDir = new Map<string, ParsedFile[]>()
  const middlewareByDir = new Map<string, string>()
  const allDirs = new Set<string>()

  for (const p of parsed) {
    allDirs.add(p.physicalDir)
    let ancestor = p.physicalDir
    while (ancestor !== '') {
      const idx = ancestor.lastIndexOf('/')
      ancestor = idx === -1 ? '' : ancestor.slice(0, idx)
      allDirs.add(ancestor)
    }

    const basename = p.file.split('/').pop() ?? ''
    if (basename === 'middleware.ts' || basename === 'middleware.tsx') {
      if (middlewareByDir.has(p.physicalDir)) {
        throw new ManifestError(
          'MULTIPLE_MIDDLEWARES',
          `Multiple middleware files in "${p.physicalDir}"`,
        )
      }
      middlewareByDir.set(p.physicalDir, p.file)
      continue
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

  const routes = buildForDir('', layoutByDir, childrenByDir, middlewareByDir, allDirs, 0, [])

  const urlMap = new Map<string, string[]>()
  collectAbsoluteUrls(routes, '', urlMap)
  for (const [url, files] of urlMap) {
    if (files.length > 1) {
      throw new ManifestError('COLLISION', `Path collision at "${url || '/'}": ${files.join(', ')}`)
    }
  }

  return { routes }
}
