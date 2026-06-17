import { describe, it, expect } from 'vitest'
import { runWithRequestEvent, getRequestEvent, type RouterEvent } from './request-context.js'

describe('request-context', () => {
  it('provides the event inside runWithRequestEvent', () => {
    const event: RouterEvent = { cookies: () => ({ token: 'abc' }), pathname: '/test' }
    let received: RouterEvent | undefined
    runWithRequestEvent(event, () => {
      received = getRequestEvent()
    })
    expect(received).toBe(event)
  })

  it('returns undefined outside of runWithRequestEvent', () => {
    expect(getRequestEvent()).toBeUndefined()
  })

  it('returns the value from the fn', () => {
    const event: RouterEvent = { cookies: () => ({}), pathname: '/' }
    const result = runWithRequestEvent(event, () => 42)
    expect(result).toBe(42)
  })

  it('isolates events between concurrent runs', async () => {
    const event1: RouterEvent = { cookies: () => ({ token: '1' }), pathname: '/a' }
    const event2: RouterEvent = { cookies: () => ({ token: '2' }), pathname: '/b' }
    const promises = [
      new Promise<string | undefined>((resolve) => {
        runWithRequestEvent(event1, () => {
          setTimeout(() => resolve(getRequestEvent()?.cookies().token), 10)
        })
      }),
      new Promise<string | undefined>((resolve) => {
        runWithRequestEvent(event2, () => {
          setTimeout(() => resolve(getRequestEvent()?.cookies().token), 5)
        })
      }),
    ]
    const results = await Promise.all(promises)
    expect(results).toEqual(['1', '2'])
  })
})
