import {describe, it, expect} from 'vitest'
import {matchPathGlob, matchesAnyGlob} from '../../src/utils/glob'

describe('matchPathGlob', () => {
    it('matches exact literal', () => {
        expect(matchPathGlob('/v1/me', '/v1/me')).toBe(true)
        expect(matchPathGlob('/v1/me', '/v1/other')).toBe(false)
    })

    it('** matches deep subpaths', () => {
        expect(matchPathGlob('/v1/users/123', '/v1/**')).toBe(true)
        expect(matchPathGlob('/v1/users/123/posts/abc', '/v1/**')).toBe(true)
        expect(matchPathGlob('/v2/users/123', '/v1/**')).toBe(false)
    })

    it('* matches single segment without /', () => {
        expect(matchPathGlob('/v1/users', '/v1/*')).toBe(true)
        expect(matchPathGlob('/v1/users/123', '/v1/*')).toBe(false)
    })

    it(':param matches single segment', () => {
        expect(matchPathGlob('/v1/users/123', '/v1/users/:id')).toBe(true)
        expect(matchPathGlob('/v1/users/123/posts', '/v1/users/:id')).toBe(false)
    })

    it('escapes regex special chars in literal segments', () => {
        expect(matchPathGlob('/v1/path.json', '/v1/path.json')).toBe(true)
        expect(matchPathGlob('/v1/pathXjson', '/v1/path.json')).toBe(false)
    })

    it('combines wildcards', () => {
        expect(matchPathGlob('/v1/users/123/posts/abc', '/v1/users/:id/posts/*')).toBe(true)
        expect(matchPathGlob('/v1/users/123/posts/abc/def', '/v1/users/:id/posts/*')).toBe(false)
    })
})

describe('matchesAnyGlob', () => {
    it('matches if any pattern matches', () => {
        expect(matchesAnyGlob('/v1/me', ['/v2/**', '/v1/**'])).toBe(true)
        expect(matchesAnyGlob('/v1/me', ['/v2/**', '/v3/**'])).toBe(false)
    })

    it('empty/undefined patterns returns false', () => {
        expect(matchesAnyGlob('/v1/me', [])).toBe(false)
        expect(matchesAnyGlob('/v1/me', undefined)).toBe(false)
    })
})
