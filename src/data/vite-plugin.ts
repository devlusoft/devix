import type { Plugin } from 'vite'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import crypto from 'node:crypto'

const traverse = (
  (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse
) as (ast: unknown, visitors: Record<string, (path: any) => void>) => void
const generate = (
  (_generate as unknown as { default?: typeof _generate }).default ?? _generate
) as (ast: unknown, options?: Record<string, unknown>, code?: string) => { code: string; map: unknown }

const INJECT_IMPORT_SERVER = `import { devixAction } from '@devlusoft/devix/data/internal/server'`
const INJECT_IMPORT_CLIENT = `import { devixActionClient } from '@devlusoft/devix/data/internal/client'`

export function dataTransform(): Plugin {
  return {
    name: 'devix:data-transform',
    enforce: 'pre',
    transform(code, id, options) {
      if (id.includes('node_modules')) return null
      if (!/\baction\s*\(/.test(code)) return null

      let ast: unknown
      try {
        ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        })
      } catch {
        return null
      }

      let modified = false
      const isSSR = options?.ssr === true
      traverse(ast, {
        CallExpression(path: any) {
          const callee = path.node?.callee
          if (callee?.type !== 'Identifier' || callee.name !== 'action') return
          if (!Array.isArray(path.node.arguments) || path.node.arguments.length !== 1) return

          const parent = path.parentPath
          let exportName: string | null = null

          if (parent?.isVariableDeclarator?.() && parent.node?.id?.type === 'Identifier') {
            exportName = parent.node.id.name
          } else if (
            parent?.isExportNamedDeclaration?.() &&
            parent.node?.declaration?.type === 'VariableDeclaration'
          ) {
            const decls = parent.node.declaration.declarations
            const decl = Array.isArray(decls) ? decls[0] : undefined
            if (decl?.id?.type === 'Identifier') exportName = decl.id.name
          } else if (parent?.isExportDefaultDeclaration?.()) {
            exportName = 'default'
          }

          if (!exportName) return

          const hash = crypto
            .createHash('sha256')
            .update(`${id}:${exportName}`)
            .digest('hex')
            .slice(0, 16)
          const fullId = `action:${hash}`

          if (isSSR) {
            const arg = path.node.arguments[0]
            if (!arg) return
            path.replaceWith(
              t.callExpression(t.identifier('devixAction'), [
                t.stringLiteral(fullId),
                arg as t.Expression,
              ]),
            )
          } else {
            path.replaceWith(
              t.callExpression(t.identifier('devixActionClient'), [
                t.stringLiteral(fullId),
              ]),
            )
          }
          modified = true
        },
      })

      if (!modified) return null
      const output = generate(ast)
      let result = output.code
      const injectPath = isSSR
        ? '@devlusoft/devix/data/internal/server'
        : '@devlusoft/devix/data/internal/client'
      const injectImport = isSSR ? INJECT_IMPORT_SERVER : INJECT_IMPORT_CLIENT
      if (!result.includes(injectPath)) {
        result = `${injectImport}\n${result}`
      }
      return { code: result, map: null }
    },
  }
}
