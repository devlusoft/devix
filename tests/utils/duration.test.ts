import {describe, it, expect} from 'vitest'
import {parseDuration} from '../../src/utils/duration'

describe('parseDuration', () => {
    it('devuelve el número directamente si es number', () => {
        expect(parseDuration(5000)).toBe(5000)
        expect(parseDuration(0)).toBe(0)
    })

    it('parsea milisegundos con sufijo ms', () => {
        expect(parseDuration('500ms')).toBe(500)
        expect(parseDuration('1000ms')).toBe(1000)
    })

    it('parsea segundos con sufijo s', () => {
        expect(parseDuration('5s')).toBe(5_000)
        expect(parseDuration('30s')).toBe(30_000)
    })

    it('parsea minutos con sufijo m', () => {
        expect(parseDuration('1m')).toBe(60_000)
        expect(parseDuration('5m')).toBe(300_000)
    })

    it('parsea horas con sufijo h', () => {
        expect(parseDuration('1h')).toBe(3_600_000)
        expect(parseDuration('2h')).toBe(7_200_000)
    })

    it('parsea string sin sufijo como milisegundos', () => {
        expect(parseDuration('5000')).toBe(5000)
    })

    it('parsea valores decimales', () => {
        expect(parseDuration('1.5s')).toBe(1_500)
        expect(parseDuration('0.5m')).toBe(30_000)
    })

    it('ignora espacios alrededor del valor', () => {
        expect(parseDuration('  5s  ')).toBe(5_000)
    })

    it('lanza error con formato inválido', () => {
        expect(() => parseDuration('5x')).toThrow('[devix] Invalid duration')
        expect(() => parseDuration('abc')).toThrow('[devix] Invalid duration')
        expect(() => parseDuration('')).toThrow('[devix] Invalid duration')
    })
})
