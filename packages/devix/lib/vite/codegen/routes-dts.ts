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
        return `// auto-generado por devix — no editar\nexport {}\ndeclare module '@devlusoft/devix' {\n  interface ApiRoutes {}\n}\n`
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

type JsonResponse<T, S extends number = number> = Response & { readonly __body: T; readonly __status: S }
type Is2xx<S extends number> = [number] extends [S] ? boolean : S extends 200 | 201 | 202 | 203 | 204 | 205 | 206 ? true : false
type UnwrapSuccessJson<T> = T extends JsonResponse<infer U, infer S> ? Is2xx<S> extends false ? never : U : never
type UnwrapErrorJson<T> = T extends JsonResponse<infer U, infer S> ? Is2xx<S> extends true ? never : U : never
type InferFnSuccess<T> = T extends (...args: any[]) => any ? UnwrapSuccessJson<Awaited<ReturnType<T>>> : never
type InferFnErrors<T> = T extends (...args: any[]) => any ? UnwrapErrorJson<Awaited<ReturnType<T>>> : never
type InferRoute<T> =
  T extends { readonly __return?: infer TReturn; readonly __body?: infer TBody }
    ? {
        __body: [TBody] extends [undefined] ? never : Exclude<TBody, undefined>
        __response: InferFnSuccess<() => TReturn>
        __errors: InferFnErrors<() => TReturn>
      }
    : InferFnSuccess<T>

declare module '@devlusoft/devix' {
  interface ApiRoutes {
${routeLines}
  }
}
`
}
