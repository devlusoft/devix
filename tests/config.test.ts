import {describe, it, expect, vi, beforeEach} from "vitest"
import {defineConfig, resolveDirs} from "../src/config";

describe("resolveDirs", () => {
    it('usa "app" como appDir por defecto', () => {
        expect(resolveDirs({})).toEqual({
            appDir: 'app',
            pagesDir: 'app/pages',
            apiDir: 'app/api',
        })
    })

    it('respeta un appDir personalizado', () => {
        expect(resolveDirs({appDir: 'src/app'})).toEqual({
            appDir: 'src/app',
            pagesDir: 'src/app/pages',
            apiDir: 'src/app/api',
        })
    })
})

describe("defineConfig", () => {
    it('devuelve la config sin modificarla', () => {
        const config = {port: 4000}
        expect(defineConfig(config)).toEqual(config)
    });
})

describe("defineConfig — server config validation", () => {
    beforeEach(() => vi.restoreAllMocks())

    it('acepta config válido con allowedPaths', () => {
        expect(() => defineConfig({
            server: {
                api: {url: 'http://localhost:8080', allowedPaths: ['/v1/**']},
            },
        })).not.toThrow()
    })

    it('rechaza namespace con caracteres inválidos', () => {
        expect(() => defineConfig({
            server: {
                'my-api': {url: 'http://x', allowedPaths: ['/**']},
            },
        })).toThrow(/Invalid server namespace/)
    })

    it('rechaza namespace que empieza con número', () => {
        expect(() => defineConfig({
            server: {
                '1api': {url: 'http://x', allowedPaths: ['/**']},
            },
        })).toThrow(/Invalid server namespace/)
    })

    it('rechaza url ausente o inválida', () => {
        expect(() => defineConfig({
            server: {api: {url: '', allowedPaths: ['/**']}} as any,
        })).toThrow(/url is required/)

        expect(() => defineConfig({
            server: {api: {url: 'not-a-url', allowedPaths: ['/**']}},
        })).toThrow(/not a valid URL/)
    })

    it('emite warning si no se configura allowedPaths', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        defineConfig({
            server: {api: {url: 'http://localhost:8080'}},
        })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('no allowedPaths'))
    })

    it('múltiples namespaces son válidos', () => {
        expect(() => defineConfig({
            server: {
                api: {url: 'http://localhost:8080', allowedPaths: ['/v1/**']},
                analytics: {url: 'http://localhost:9090', allowedPaths: ['/track']},
            },
        })).not.toThrow()
    })
})