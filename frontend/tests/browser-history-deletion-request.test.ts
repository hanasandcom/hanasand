import { afterEach, expect, test } from 'bun:test'
import { deleteBrowserHistory } from '../src/app/browser/historyDeletion'

const originalFetch = globalThis.fetch
const calls: Array<{ url: string, options?: RequestInit }> = []

afterEach(() => {
    globalThis.fetch = originalFetch
    calls.length = 0
})

test('deletes selected history with authenticated proxy options and JSON body', async () => {
    globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options })
        return Response.json({})
    }) as typeof fetch

    await deleteBrowserHistory('browser-client', ['run-1'], 'Could not delete this run.')

    const call = calls[0]!
    expect(call.url).toBe('/api/backend/browser/runs')
    expect(call.options?.method).toBe('DELETE')
    expect(call.options?.credentials).toBe('include')
    expect(new Headers(call.options?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(call.options?.body))).toEqual({ clientId: 'browser-client', ids: ['run-1'] })
})

test('preserves an empty ids array instead of converting it to a clear-all request', async () => {
    globalThis.fetch = (async (_url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: '', options })
        return Response.json({})
    }) as typeof fetch

    await deleteBrowserHistory('browser-client', [], 'fallback')

    expect(JSON.parse(String(calls[0]?.options?.body))).toEqual({ clientId: 'browser-client', ids: [] })
})

test('uses clear true only when ids are omitted and preserves caller-specific errors', async () => {
    globalThis.fetch = (async (_url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: '', options })
        return Response.json({})
    }) as typeof fetch
    await deleteBrowserHistory('browser-client', undefined, 'Could not delete browser history.')
    expect(JSON.parse(String(calls[0]?.options?.body))).toEqual({ clientId: 'browser-client', clear: true })

    globalThis.fetch = (async () => Response.json({}, { status: 500 })) as typeof fetch
    await expect(deleteBrowserHistory('browser-client', ['run-2'], 'Could not delete this run.')).rejects.toThrow('Could not delete this run.')

    globalThis.fetch = (async () => Response.json({ error: 'History is locked.' }, { status: 500 })) as typeof fetch
    await expect(deleteBrowserHistory('browser-client', undefined, 'Could not delete browser history.')).rejects.toThrow('History is locked.')
})
