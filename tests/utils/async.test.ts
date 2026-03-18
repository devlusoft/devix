import {describe, it, expect, vi} from 'vitest'
import {withTimeout} from '../../src/utils/async'

describe('withTimeout', () => {
    it('resuelve si la promise termina antes del timeout', async () => {
        const result = await withTimeout(Promise.resolve(42), 1000)
        expect(result).toBe(42)
    })

    it('lanza si la promise tarda más que el timeout', async () => {
        vi.useFakeTimers()
        const slow = new Promise(resolve => setTimeout(resolve, 5000))
        const race = withTimeout(slow, 100)
        vi.advanceTimersByTime(200)
        await expect(race).rejects.toThrow('timed out after 100ms')
        vi.useRealTimers()
    })

    it('el mensaje de error incluye el tiempo configurado', async () => {
        vi.useFakeTimers()
        const slow = new Promise(resolve => setTimeout(resolve, 5000))
        const race = withTimeout(slow, 3000)
        vi.advanceTimersByTime(4000)
        await expect(race).rejects.toThrow('timed out after 3000ms')
        vi.useRealTimers()
    })
})