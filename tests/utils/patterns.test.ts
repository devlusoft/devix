import {describe, it, expect} from 'vitest'
import {routePattern} from '../../src/utils/patterns'

describe('routePattern', () => {
    it('convierte index.tsx a /', () => {
        expect(routePattern('index.tsx')).toBe('/')
    })
    it('convierte una página simple', () => {
        expect(routePattern('about.tsx')).toBe('about')
    })
    it('convierte nested index al padre', () => {
        expect(routePattern('blog/index.tsx')).toBe('blog')
    })
    it('convierte segmentos dinámicos', () => {
        expect(routePattern('blog/[slug].tsx')).toBe('blog/:slug')
    })
    it('convierte múltiples segmentos dinámicos', () => {
        expect(routePattern('[org]/[repo].tsx')).toBe(':org/:repo')
    })
    it('elimina route groups del path', () => {
        expect(routePattern('(auth)/login.tsx')).toBe('login')
    })
})