import { keyToRoutePattern } from '../../server/api-router'
import type { HttpMethod } from './extract-methods'

export interface RouteEntry {
    filePath: string
    urlPattern: string
    identifier: string
    methods: HttpMethod[]
}

export function filePathToIdentifier(filePath: string, apiDir: string): string {
    return '_api_' + filePath
        .slice(`${apiDir}/`.length)
        .replace(/\.(ts|tsx)$/, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
}

export function buildRouteEntry(filePath: string, apiDir: string, methods: HttpMethod[]): RouteEntry {
    return {
        filePath,
        urlPattern: keyToRoutePattern(filePath, apiDir),
        identifier: filePathToIdentifier(filePath, apiDir),
        methods,
    }
}

export function generateRoutesDts(entries: RouteEntry[], apiDir: string): string {
    if (entries.length === 0) {
        return `// auto-generado por devix — no editar\ndeclare module '@devlusoft/devix' {\n  interface ApiRoutes {}\n}\n`
    }

    const imports = entries
        .map(e => {
            const importPath = '../' + e.filePath.replace(/\.(ts|tsx)$/, '')
            return `import type * as ${e.identifier} from '${importPath}'`
        })
        .join('\n')

    const routeLines = entries.flatMap(e =>
        e.methods.map(m =>
            `    '${m} ${e.urlPattern}': InferRoute<(typeof ${e.identifier})['${m}']>`
        )
    ).join('\n')

    return `// auto-generado por devix — no editar
${imports}

type JsonResponse<T> = Response & { readonly __body: T }
type UnwrapJson<T> = T extends JsonResponse<infer U> ? U : never
type InferFnReturn<T> = T extends (...args: any[]) => any
  ? UnwrapJson<Awaited<ReturnType<T>>> | Exclude<Awaited<ReturnType<T>>, JsonResponse<any> | null | void | undefined>
  : never
type InferRoute<T> =
  T extends { readonly __return?: infer TReturn; readonly __body?: infer TBody }
    ? {
        __body: [TBody] extends [undefined] ? never : Exclude<TBody, undefined>
        __response: InferFnReturn<() => TReturn>
      }
    : InferFnReturn<T>

declare module '@devlusoft/devix' {
  interface ApiRoutes {
${routeLines}
  }
}
`
}
