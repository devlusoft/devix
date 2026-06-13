import { generateCode, parseModule } from 'magicast'
import type { Plugin } from 'vite'

const SERVER_FACTORIES = new Set(['query', 'action'])
const PRE_CHECK = /\b(?:query|action)\s*\(/

type FunctionCallNode = { $type?: string; $callee?: string; $args?: unknown[] }

function isServerFactoryCall(node: unknown): node is FunctionCallNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    '$type' in node &&
    (node as FunctionCallNode).$type === 'function-call' &&
    SERVER_FACTORIES.has((node as FunctionCallNode).$callee ?? '')
  )
}

export function dataTransform(): Plugin {
  return {
    name: 'devix:data-transform',
    enforce: 'pre',

    transform(code, id) {
      if (!PRE_CHECK.test(code)) return null
      if (id.includes('node_modules')) return null
      if (this.environment?.name === 'ssr') return null

      let mod
      try {
        mod = parseModule(code)
      } catch {
        return null
      }

      let touched = false
      for (const exp of Object.values(mod.exports)) {
        if (isServerFactoryCall(exp)) {
          exp.$args![0] = undefined
          touched = true
        }
      }

      if (!touched) return null
      const { code: out, map } = generateCode(mod)
      return { code: out, map }
    },
  }
}
