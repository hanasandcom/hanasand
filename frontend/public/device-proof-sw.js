const DB_NAME = 'hanasand-device-proof-worker'
const DB_VERSION = 1
const encoder = new TextEncoder()
let devicePromise

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('message', event => {
    const message = event.data
    if (message?.channel !== 'hanasand-device-proof') return
    const reply = event.ports?.[0]
    event.waitUntil((async () => {
        try {
            const device = await loadOrCreateDevice()
            if (message.type === 'get-public-key') {
                reply?.postMessage({ publicJwk: device.publicJwk })
                return
            }
            if (message.type === 'update-token-hash') {
                await saveTokenHash(typeof message.tokenHash === 'string' ? message.tokenHash : '')
                reply?.postMessage({ ok: true })
                return
            }
            if (message.type === 'create-proof') {
                const proof = await createProof(device, message.token, message.method, message.url)
                reply?.postMessage({ proof, publicJwk: device.publicJwk })
            }
        } catch {
            reply?.postMessage({ error: 'Device proof is unavailable.' })
        }
    })())
})

self.addEventListener('fetch', event => {
    const request = event.request
    const url = new URL(request.url)
    if (url.origin !== self.location.origin || !needsProof(request, url)) return

    event.respondWith((async () => {
        let device
        try { device = await loadOrCreateDevice() } catch { return new Response('Secure sign-in is unavailable in this browser.', { status: 503 }) }
        const headers = new Headers(request.headers)
        headers.set('X-Device-Public-Jwk', JSON.stringify(device.publicJwk))
        if (!headers.has('DPoP')) {
            const token = bearerToken(headers.get('authorization'))
            const proof = await createProof(device, token, request.method, url.toString()).catch(() => '')
            if (proof) {
                headers.set('DPoP', proof)
                headers.set('X-Device-Proof-Url', normalizeUrl(url))
                headers.set('X-Device-Proof-Method', request.method.toUpperCase())
            }
        }
        return fetch(new Request(request, { headers }))
    })())
})

function needsProof(request, url) {
    if (request.mode === 'navigate') return true
    if (request.headers.has('next-action') || request.headers.has('rsc') || request.headers.get('accept')?.includes('text/x-component')) return true
    if (!url.pathname.startsWith('/api/')) return false
    if (url.pathname === '/api/health' || url.pathname === '/api/status') return false
    if (/^\/api\/files\/[0-9a-f-]{36}$/i.test(url.pathname) && ['GET', 'HEAD'].includes(request.method)) return false
    return true
}

async function createProof(device, token, method, requestUrl) {
    const url = new URL(requestUrl)
    const claims = {
        htm: method.toUpperCase(),
        htu: normalizeUrl(url),
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID(),
        ath: token ? await tokenHash(token) : await currentTokenHash(),
    }
    if (!claims.ath) return ''
    const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: device.publicJwk }
    const input = `${encode(header)}.${encode(claims)}`
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, device.privateKey, encoder.encode(input))
    return `${input}.${toBase64Url(new Uint8Array(signature))}`
}

function normalizeUrl(value) {
    const url = value instanceof URL ? new URL(value) : new URL(value)
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
}

async function tokenHash(token) {
    return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))))
}

async function currentTokenHash() {
    const value = await read('tokenHash')
    return typeof value === 'string' ? value : ''
}

function bearerToken(value) {
    return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

function encode(value) { return toBase64Url(encoder.encode(JSON.stringify(value))) }

function toBase64Url(bytes) {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

async function loadOrCreateDevice() {
    if (!devicePromise) devicePromise = loadOrCreateDeviceOnce()
    try { return await devicePromise } catch (error) { devicePromise = undefined; throw error }
}

async function loadOrCreateDeviceOnce() {
    const stored = await read('device')
    if (stored?.privateKey && stored.publicJwk) return stored
    const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
    const publicJwk = await crypto.subtle.exportKey('jwk', keys.publicKey)
    const device = { privateKey: keys.privateKey, publicJwk: { kty: 'EC', crv: 'P-256', x: publicJwk.x, y: publicJwk.y } }
    await write('device', device)
    return device
}

async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            const database = request.result
            if (!database.objectStoreNames.contains('device')) database.createObjectStore('device')
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function read(key) {
    const database = await openDatabase()
    return new Promise((resolve, reject) => {
        const request = database.transaction('device').objectStore('device').get(key)
        request.onsuccess = () => { database.close(); resolve(request.result) }
        request.onerror = () => { database.close(); reject(request.error) }
    })
}

async function write(key, value) {
    const database = await openDatabase()
    return new Promise((resolve, reject) => {
        const request = database.transaction('device', 'readwrite').objectStore('device').put(value, key)
        request.onsuccess = () => { database.close(); resolve() }
        request.onerror = () => { database.close(); reject(request.error) }
    })
}

async function saveTokenHash(tokenHash) {
    return write('tokenHash', tokenHash)
}
