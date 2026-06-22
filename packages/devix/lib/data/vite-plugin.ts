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

const INJECT_ACTION_SERVER = `import { devixAction } from '@devlusoft/devix/data/internal/server'`
const INJECT_CLIENT = `import { devixActionClient, clientQuery } from '@devlusoft/devix/data/internal/client'`

const ACTION_OR_QUERY_RE = /\b(action|query)\s*\(/
const SERVER_PATH = '@devlusoft/devix/data/internal/server'
const CLIENT_PATH = '@devlusoft/devix/data/internal/client'

export function dataTransform(): Plugin {
  return {
    name: 'devix:data-transform',
    enforce: 'pre',
    transform(code, id, options) {
      if (id.includes('node_modules')) return null
      if (!ACTION_OR_QUERY_RE.test(code)) return null

      let ast: unknown
      try {
        ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        })
      } catch {
        return null
      }

      let actionModified = false
      let queryModified = false
      const isSSR = options?.ssr === true

      traverse(ast, {
        CallExpression(path: any) {
          const callee = path.node?.callee
          if (callee?.type !== 'Identifier') return

          if (callee.name === 'action') {
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
            actionModified = true
            return
          }

          if (callee.name === 'query') {
            if (!Array.isArray(path.node.arguments) || path.node.arguments.length !== 2) return
            const [, nameArg] = path.node.arguments
            if (!nameArg) return
            if (nameArg.type !== 'StringLiteral' || typeof nameArg.value !== 'string') return

            if (isSSR) {
              return
            }

            path.replaceWith(
              t.callExpression(t.identifier('clientQuery'), [
                t.stringLiteral(nameArg.value),
              ]),
            )
            queryModified = true
          }
        },
      })

      if (!actionModified && !queryModified) return null
      const output = generate(ast)
      let result = output.code

      if (actionModified && isSSR && !result.includes(SERVER_PATH)) {
        result = `${INJECT_ACTION_SERVER}\n${result}`
      }

      if (!isSSR && (actionModified || queryModified) && !result.includes(CLIENT_PATH)) {
        result = `${INJECT_CLIENT}\n${result}`
      }

      return { code: result, map: null }
    },
  }
}