interface ClientRoutesOptions {
    pagesDir: string
    matcherPath: string
}

export function generateClientRoutes({pagesDir, matcherPath}: ClientRoutesOptions) {
    return `
import React from 'react'
import { createMatcher } from '${matcherPath}'
const pageFiles = import.meta.glob(['/${pagesDir}/**/*.tsx', '!**/error.tsx', '!**/layout.tsx'])
const layoutFiles = import.meta.glob('/${pagesDir}/**/layout.tsx')
const errorFiles = import.meta.glob('/${pagesDir}/**/error.tsx')

export const matchClientRoute = createMatcher(pageFiles, layoutFiles)

export async function loadErrorPage() {
    const key = Object.keys(errorFiles)[0]
    if (!key) return null
    const mod = await errorFiles[key]()
    return mod?.default ?? null
}

export function getDefaultErrorPage() {
    return function DefaultError({ statusCode, message }) {
        return React.createElement('main', {
            style: { minHeight: '100dvh', display: 'flex', flexDirection: 'column', 
                     alignItems: 'center', justifyContent: 'center', gap: '8px',
                     fontFamily: 'system-ui, sans-serif' }
        },
            React.createElement('h1', {style: {fontSize: '4rem', fontWeight: 700}}, statusCode),
            React.createElement('p', {style: {color: '#666'}}, message ?? 'An unexpected error occurred'),
        )
    }
}
`
}