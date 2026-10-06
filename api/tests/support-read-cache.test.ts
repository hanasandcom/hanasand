import { afterEach, expect, test } from 'bun:test'
import { cachedSupportRead, clearSupportReadCache } from '../src/utils/support/readCache.ts'

afterEach(clearSupportReadCache)

test('reuses a hot value for the same authorization-scoped key', async () => {
    let loads = 0
    const load = async () => ({ transcript: ++loads })

    expect(await cachedSupportRead('messages:user-a:ticket-1', load)).toEqual({ transcript: 1 })
    expect(await cachedSupportRead('messages:user-a:ticket-1', load)).toEqual({ transcript: 1 })
    expect(await cachedSupportRead('messages:user-b:ticket-1', load)).toEqual({ transcript: 2 })
    expect(loads).toBe(2)
})

test('deduplicates simultaneous cache misses and drops failed reads', async () => {
    let loads = 0
    let release!: (value: string) => void
    const pending = new Promise<string>(resolve => { release = resolve })
    const load = () => { loads++; return pending }

    const first = cachedSupportRead('tickets:user-a', load)
    const second = cachedSupportRead('tickets:user-a', load)
    expect(loads).toBe(1)
    release('ready')
    expect(await Promise.all([first, second])).toEqual(['ready', 'ready'])

    let failures = 0
    const failing = () => { failures++; return Promise.reject(new Error('temporary')) }
    await expect(cachedSupportRead('tickets:user-a:failure', failing)).rejects.toThrow('temporary')
    await expect(cachedSupportRead('tickets:user-a:failure', async () => 'recovered')).resolves.toBe('recovered')
    expect(failures).toBe(1)
})

test('clears cached reads after support writes', async () => {
    let loads = 0
    const load = async () => ++loads

    expect(await cachedSupportRead('tickets:user-a', load)).toBe(1)
    clearSupportReadCache()
    expect(await cachedSupportRead('tickets:user-a', load)).toBe(2)
})
