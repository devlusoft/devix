import {describe, it, expect} from "vitest"
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