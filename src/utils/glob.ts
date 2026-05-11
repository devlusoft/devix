/**
 * Match simple de path contra un glob estilo `'/v1/**'`, `'/v1/users/*'`, `'/v1/users/:id'`.
 *
 * Reglas:
 * - `**` matchea cualquier subpath (incluye `/`).
 * - `*` matchea un único segmento (sin `/`).
 * - `:param` matchea un único segmento.
 * - Cualquier otro caracter es literal.
 */
export function matchPathGlob(path: string, pattern: string): boolean {
    const regex = globToRegex(pattern)
    return regex.test(path)
}

export function matchesAnyGlob(path: string, patterns: readonly string[] | undefined): boolean {
    if (!patterns || patterns.length === 0) return false
    for (const pattern of patterns) {
        if (matchPathGlob(path, pattern)) return true
    }
    return false
}

function globToRegex(pattern: string): RegExp {
    let regex = ''
    let i = 0
    while (i < pattern.length) {
        const c = pattern[i]
        if (c === '*' && pattern[i + 1] === '*') {
            regex += '.*'
            i += 2
        } else if (c === '*') {
            regex += '[^/]*'
            i += 1
        } else if (c === ':') {
            i += 1
            while (i < pattern.length && /[a-zA-Z0-9_]/.test(pattern[i])) i += 1
            regex += '[^/]+'
        } else if ('.+?^$()|[]{}\\'.includes(c)) {
            regex += '\\' + c
            i += 1
        } else {
            regex += c
            i += 1
        }
    }
    return new RegExp(`^${regex}$`)
}
