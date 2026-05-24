import {parseSync} from 'oxc-parser'

const QUERY_STUB = 'async (...$a) => { throw new Error("server-only code") }'

function getActionFileRel(id: string, appDir: string): string | null {
  const marker = `/${appDir}/actions/`
  const idx = id.indexOf(marker)
  if (idx === -1) return null
  return id
    .slice(idx + marker.length)
    .replace(/\.(ts|tsx)$/, '')
    .replace(/\//g, '_')
}

function collectImportNames(program: any): {query: Set<string>; action: Set<string>} {
  const query = new Set<string>()
  const action = new Set<string>()

  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') continue
    if (node.source.value !== '@devlusoft/devix') continue

    for (const spec of node.specifiers) {
      if (spec.type !== 'ImportSpecifier') continue
      const local = spec.local.name
      if (spec.imported.name === 'query') query.add(local)
      if (spec.imported.name === 'action') action.add(local)
    }
  }

  return {query, action}
}

function walkForQueryCalls(
  node: any,
  calleeNames: Set<string>,
  results: {fnStart: number; fnEnd: number}[],
): void {
  if (!node || typeof node !== 'object') return

  if (node.type === 'CallExpression') {
    const callee = node.callee
    if (callee?.type === 'Identifier' && calleeNames.has(callee.name)) {
      if (node.arguments.length > 0) {
        const fnArg = node.arguments[0]
        if (fnArg.type === 'ArrowFunctionExpression' || fnArg.type === 'FunctionExpression') {
          results.push({fnStart: fnArg.start, fnEnd: fnArg.end})
        }
      }
    }
  }

  for (const key of Object.keys(node)) {
    const val = (node as Record<string, unknown>)[key]
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object' && (item as Record<string, unknown>).type) {
          walkForQueryCalls(item as any, calleeNames, results)
        }
      }
    } else if (val && typeof val === 'object' && (val as Record<string, unknown>).type) {
      walkForQueryCalls(val as any, calleeNames, results)
    }
  }
}

function findActionCall(
  node: any,
  actionNames: Set<string>,
  code: string,
  fileRel: string,
): {fnStart: number; fnEnd: number; replacement: string} | null {
  if (node.type !== 'ExportNamedDeclaration' && node.type !== 'VariableDeclaration') return null

  const decls = node.type === 'ExportNamedDeclaration'
    ? (node.declaration?.type === 'VariableDeclaration' ? node.declaration.declarations : [])
    : node.declarations

  for (const d of decls) {
    if (d.type !== 'VariableDeclarator') continue
    if (d.id?.type !== 'Identifier') continue
    const fnName = d.id.name
    const init = d.init
    if (!init || init.type !== 'CallExpression') continue
    if (init.callee?.type !== 'Identifier') continue
    if (!actionNames.has(init.callee.name)) continue
    const fnArg = init.arguments[0]
    if (!fnArg || (fnArg.type !== 'ArrowFunctionExpression' && fnArg.type !== 'FunctionExpression')) continue

    const stub = `(...$a) => globalThis.__devix_callServerAction('${fileRel}', '${fnName}', $a)`

    return {fnStart: fnArg.start, fnEnd: fnArg.end, replacement: stub}
  }

  return null
}

export function maybeTransformServerOnly(
  code: string,
  id: string,
  appDir: string,
): {code: string; map: null} | null {
  const hasQuery = code.includes('query(')
  const hasAction = code.includes('action(')
  if (!hasQuery && !hasAction) return null

  let ast: any
  try {
    ast = parseSync(id, code, {sourceType: 'module'})
  } catch {
    return null
  }

  const {query, action} = collectImportNames(ast.program)
  if (query.size === 0 && action.size === 0) return null

  const allQueryNames = new Set<string>()
  for (const n of query) allQueryNames.add(n)

  const replacements: {start: number; end: number; replacement: string}[] = []

  if (action.size > 0) {
    const fileRel = getActionFileRel(id, appDir)
    if (fileRel) {
      for (const node of ast.program.body) {
        const r = findActionCall(node, action, code, fileRel)
        if (r) replacements.push({start: r.fnStart, end: r.fnEnd, replacement: r.replacement})
      }
    }
  }

  if (query.size > 0) {
    const calls: {fnStart: number; fnEnd: number}[] = []
    walkForQueryCalls(ast.program, allQueryNames, calls)
    for (const c of calls) {
      replacements.push({start: c.fnStart, end: c.fnEnd, replacement: QUERY_STUB})
    }
  }

  if (replacements.length === 0) return null

  replacements.sort((a, b) => b.start - a.start)

  let result = code
  for (const {start, end, replacement} of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end)
  }

  return {code: result, map: null}
}
