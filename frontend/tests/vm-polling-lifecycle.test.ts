// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { startVMPolling } from '../src/components/vms/pollingLifecycle'

test('connection refresh can recover after a terminal response without automatic retries', async () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const listeners = new Map<string, Set<() => void>>()
    const addListener = (name: string, listener: () => void) => {
        const handlers = listeners.get(name) ?? new Set()
        handlers.add(listener)
        listeners.set(name, handlers)
    }
    const removeListener = (name: string, listener: () => void) => listeners.get(name)?.delete(listener)
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        addEventListener: addListener, removeEventListener: removeListener,
    } })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        visibilityState: 'visible', addEventListener: addListener, removeEventListener: removeListener,
    } })

    let requests = 0
    let recovered!: () => void
    const recovery = new Promise<void>(resolve => { recovered = resolve })
    const lifecycle = startVMPolling(async () => {
        requests += 1
        if (requests === 1) return false
        recovered()
        return true
    }, { intervalMs: 20, maxRetryMs: 20, allowTerminalRefresh: true })

    try {
        await new Promise(resolve => setTimeout(resolve, 5))
        expect(requests).toBe(1)
        await new Promise(resolve => setTimeout(resolve, 40))
        expect(requests).toBe(1)
        lifecycle.refresh()
        await recovery
        expect(requests).toBe(2)
    } finally {
        lifecycle.dispose()
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
        else Reflect.deleteProperty(globalThis, 'window')
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})
