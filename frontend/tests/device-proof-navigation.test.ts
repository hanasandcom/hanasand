import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import { test } from 'node:test'
import { browserSessionRedirect } from '../src/app/api/auth/social/browserSessionRedirect'

const source = await readFile(new URL('../public/device-proof-sw.js', import.meta.url), 'utf8')
const oldHash = 'a'.repeat(43)
const newHash = 'b'.repeat(43)

async function workerHarness(responseOrigin = 'https://hanasand.com', hash = newHash) {
    const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
    const jwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey)
    const store = new Map<string, unknown>([
        ['device', { privateKey: keys.privateKey, publicJwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y } }],
        ['tokenHash', oldHash],
    ])
    const requests: Request[] = []
    type FetchEvent = { request: { url: string; method: string; mode: string; headers: Headers }; respondWith(value: Promise<Response>): void }
    const listeners = new Map<string, (event: FetchEvent) => void>()
    function operation<T>(result: T) {
        const request: { result: T; onsuccess?: () => void } = { result }
        queueMicrotask(() => request.onsuccess?.())
        return request
    }
    const database = { close() {}, transaction() { return { objectStore() { return {
        get: (key: string) => operation(store.get(key)),
        put(value: unknown, key: string) { store.set(key, value); return operation(key) },
    } } } } }
    class WorkerRequest extends Request {
        constructor(input: Request, init: RequestInit) { super(input.url, { method: input.method, ...init }) }
    }
    vm.runInNewContext(source, {
        self: { location: { origin: 'https://hanasand.com' }, addEventListener: (name: string, handler: (event: FetchEvent) => void) => listeners.set(name, handler) },
        crypto: webcrypto, TextEncoder, URL, Headers, Request: WorkerRequest, Response, btoa,
        indexedDB: { open: () => operation(database) },
        fetch: async (request: Request) => {
            requests.push(request)
            const response = new Response('Completing sign-in', { headers: { 'x-device-proof-token-hash': hash } })
            Object.defineProperty(response, 'url', { value: `${responseOrigin}/api/auth/social/google/callback` })
            return response
        },
    })
    return { store, requests, async navigate(path: string) {
        let pending: Promise<Response> | undefined
        listeners.get('fetch')!({ request: { url: `https://hanasand.com${path}`, method: 'GET', mode: 'navigate', headers: new Headers() }, respondWith(value) { pending = value } })
        assert.ok(pending)
        return pending
    } }
}

test('navigation callback saves the new session hash before the next protected navigation', async () => {
    const worker = await workerHarness()
    await worker.navigate('/api/auth/social/google/callback?code=synthetic&state=synthetic')
    assert.equal(worker.store.get('tokenHash'), newHash)
    await worker.navigate('/dashboard')
    const proof = worker.requests[1].headers.get('dpop')!
    const claims = JSON.parse(Buffer.from(proof.split('.')[1], 'base64url').toString())
    assert.equal(claims.ath, newHash)
    assert.equal(claims.htu, 'https://hanasand.com/dashboard')
    assert.equal(claims.htm, 'GET')
    assert.ok(worker.requests[1].headers.has('x-device-public-jwk'))
})

test('cross-origin redirect responses cannot replace the stored session hash', async () => {
    const worker = await workerHarness('https://accounts.google.com')
    await worker.navigate('/api/auth/social/google/start')
    assert.equal(worker.store.get('tokenHash'), oldHash)
})

test('invalid session hashes cannot replace the stored session hash', async () => {
    const worker = await workerHarness('https://hanasand.com', 'invalid')
    await worker.navigate('/api/auth/social/google/callback')
    assert.equal(worker.store.get('tokenHash'), oldHash)
})

test('browser callback waits for existing worker readiness and token sync before redirecting', async () => {
    const response = browserSessionRedirect(new URL('https://hanasand.com/dashboard'))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const html = await response.text()
    assert.ok(html.includes('<script src="/device-proof-client.js"></script>'))
    const inline = html.match(/<script>([\s\S]+?)<\/script>/)![1]
    const events: string[] = []
    vm.runInNewContext(inline, {
        navigator: { serviceWorker: {} },
        window: { hanasandDeviceProofReady: Promise.resolve({ sync: async () => { events.push('synced') } }), location: { replace: (target: string) => events.push(target) } },
        document: { getElementById() { throw new Error('Unexpected failure') } },
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(events, ['synced', 'https://hanasand.com/dashboard'])
})

test('worker setup failure does not navigate to a protected page', async () => {
    const html = await browserSessionRedirect(new URL('https://hanasand.com/dashboard')).text()
    const status = { textContent: '' }
    let navigated = false
    vm.runInNewContext(html.match(/<script>([\s\S]+?)<\/script>/)![1], {
        navigator: { serviceWorker: {} },
        window: { hanasandDeviceProofReady: Promise.resolve(undefined), location: { replace() { navigated = true } } },
        document: { getElementById: () => status },
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(navigated, false)
    assert.ok(status.textContent.includes('Sign-in could not be completed'))
})

test('browser callback rejects destinations outside the configured HTTPS origin', () => {
    assert.throws(() => browserSessionRedirect(new URL('https://attacker.test/dashboard')), /Invalid sign-in destination/)
    assert.throws(() => browserSessionRedirect(new URL('http://hanasand.com/dashboard')), /Invalid sign-in destination/)
    assert.throws(() => browserSessionRedirect(new URL('https://user:password@hanasand.com/dashboard')), /Invalid sign-in destination/)
})
