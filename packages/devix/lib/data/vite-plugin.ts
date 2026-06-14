import { createHash } from 'node:crypto'
import generate from '@babel/generator'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { Plugin } from 'vite'

const PRE_CHECK = /\b(?:query|action)\s*\(/
const INTERNAL_MODULE = '@devlusoft/devix/data'

function generateActionId(filePath: string, exportName: string): string {
  return createHash('sha256').update(`${filePath}:${exportName}`).digest('hex').slice(0, 16)
}

function createRpcStub(nameArg: t.StringLiteral): t.ArrowFunctionExpression {
  return t.arrowFunctionExpression(
    [t.restElement(t.identifier('args'))],
    t.callExpression(t.memberExpression(t.identifier('clientTransport'), t.identifier('current')), [
      nameArg,
      t.identifier('args'),
    ]),
    true,
  )
}

export function dataTransform(): Plugin {
  let root: string

  return {
    name: 'devix:data-transform',
    enforce: 'pre',

    configResolved(config) {
      root = config.root
    },

    transform(code, id) {
      if (!PRE_CHECK.test(code)) return null
      if (id.includes('node_modules')) return null

      const isSsr = this.environment?.name === 'ssr'

      let ast: t.File
      try {
        ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        })
      } catch {
        return null
      }

      const relativePath = root ? id.slice(root.length + 1) : id
      let touched = false
      const importsToAdd = new Set<string>()

      traverse(ast, {
        ExportNamedDeclaration(path) {
          const decl = path.node.declaration
          if (!t.isVariableDeclaration(decl)) return

          for (const variable of decl.declarations) {
            if (!t.isVariableDeclarator(variable) || !t.isIdentifier(variable.id)) continue

            const exportName = variable.id.name
            const init = variable.init
            if (!t.isCallExpression(init)) continue

            const callee = init.callee
            if (!t.isIdentifier(callee)) continue

            if (callee.name === 'query') {
              const nameArg = init.arguments[1]
              if (!t.isStringLiteral(nameArg)) continue

              if (!isSsr) {
                init.arguments[0] = createRpcStub(nameArg)
                importsToAdd.add('clientTransport')
                touched = true
              }
            } else if (callee.name === 'action') {
              const actionId = t.stringLiteral(
                `action:${generateActionId(relativePath, exportName)}`,
              )

              if (isSsr) {
                callee.name = 'devixAction'
                init.arguments.unshift(actionId)
                importsToAdd.add('devixAction')
              } else {
                callee.name = 'devixActionClient'
                init.arguments = [actionId]
                importsToAdd.add('devixActionClient')
              }
              touched = true
            }
          }
        },

        ExportDefaultDeclaration(path) {
          const declaration = path.node.declaration
          if (!t.isCallExpression(declaration)) return

          const callee = declaration.callee
          if (!t.isIdentifier(callee)) return

          const exportName = 'default'

          if (callee.name === 'query') {
            const nameArg = declaration.arguments[1]
            if (!t.isStringLiteral(nameArg)) return

            if (!isSsr) {
              declaration.arguments[0] = createRpcStub(nameArg)
              importsToAdd.add('clientTransport')
              touched = true
            }
          } else if (callee.name === 'action') {
            const actionId = t.stringLiteral(`action:${generateActionId(relativePath, exportName)}`)

            if (isSsr) {
              callee.name = 'devixAction'
              declaration.arguments.unshift(actionId)
              importsToAdd.add('devixAction')
            } else {
              callee.name = 'devixActionClient'
              declaration.arguments = [actionId]
              importsToAdd.add('devixActionClient')
            }
            touched = true
          }
        },
      })

      if (!touched) return null

      for (const name of importsToAdd) {
        const importDecl = t.importDeclaration(
          [t.importSpecifier(t.identifier(name), t.identifier(name))],
          t.stringLiteral(INTERNAL_MODULE),
        )
        ast.program.body.unshift(importDecl as t.Statement)
      }

      const output = generate(ast, { sourceMaps: true, sourceFileName: id }, code)
      return { code: output.code, map: output.map }
    },
  }
}
