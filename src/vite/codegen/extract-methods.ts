const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

const METHOD_EXPORT_RE = /export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g

function stripComments(content: string): string {
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
}

export function extractHttpMethods(content: string): HttpMethod[] {
    const found = new Set<HttpMethod>()
    for (const match of stripComments(content).matchAll(METHOD_EXPORT_RE)) {
        found.add(match[1] as HttpMethod)
    }
    return [...found]
}
