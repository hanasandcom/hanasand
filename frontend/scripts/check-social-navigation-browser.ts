import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { NextRequest } from 'next/server'
import { callback } from '../src/app/api/auth/social/proxy'

// Isolated HTTPS staging: real Chromium, IndexedDB, cookies and worker signatures;
// the Identity response uses synthetic data and never contacts an OAuth provider.
const temporary = await mkdtemp(join(tmpdir(), 'hanasand-social-navigation-'))
const keyFile = join(temporary, 'localhost.key')
const certFile = join(temporary, 'localhost.crt')
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' })
const fixedWorker = await readFile(new URL('../public/device-proof-sw.js', import.meta.url), 'utf8')
const oldWorker = execFileSync('git', ['show', '0d8656b9634556fa526fbb3b34d16721b9603bcb:frontend/public/device-proof-sw.js'], { encoding: 'utf8' })
const client = await readFile(new URL('../public/device-proof-client.js', import.meta.url), 'utf8')
const oldToken = 'synthetic-old-session'
const newToken = 'synthetic-new-session'
const originalFetch = globalThis.fetch
const originalOrigin = process.env.SOCIAL_AUTH_ORIGIN
const originalIdentity = process.env.FRONTEND_IDENTITY_API
process.env.FRONTEND_IDENTITY_API = 'http://synthetic-identity.invalid/api'
globalThis.fetch = (async (input) => {
    assert.equal(String(input), 'http://synthetic-identity.invalid/api/auth/social/google/callback')
    return Response.json({ id: 'synthetic-user', name: 'Synthetic user', avatar: '', token: newToken, expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), redirectPath: '/dashboard' })
}) as typeof fetch

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
    browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] })
    for (const [label, worker] of [['already-installed-worker', oldWorker], ['updated-worker', fixedWorker]]) {
        let dashboardVerified = false
        const server = Bun.serve({
            hostname: '127.0.0.1', port: 0,
            tls: { key: await readFile(keyFile), cert: await readFile(certFile) },
            async fetch(request) {
                const url = new URL(request.url)
                if (url.pathname === '/device-proof-sw.js') return new Response(worker, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } })
                if (url.pathname === '/device-proof-client.js') return new Response(client, { headers: { 'Content-Type': 'application/javascript' } })
                if (url.pathname === '/start') return new Response('<!doctype html><script src="/device-proof-client.js"></script><p>Start</p>', {
                    headers: { 'Content-Type': 'text/html', 'Set-Cookie': `access_token=${oldToken}; Secure; SameSite=Lax; Path=/` },
                })
                if (url.pathname === '/api/auth/social/google/callback') return callback(new NextRequest(request), 'google')
                if (url.pathname === '/dashboard') {
                    try {
                        assert.ok((request.headers.get('cookie') || '').includes(`access_token=${newToken}`))
                        const proof = request.headers.get('dpop')!
                        const [headerPart, claimsPart, signaturePart] = proof.split('.')
                        const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString())
                        const claims = JSON.parse(Buffer.from(claimsPart, 'base64url').toString())
                        assert.equal(claims.ath, createHash('sha256').update(newToken).digest('base64url'))
                        assert.equal(claims.htm, 'GET')
                        assert.equal(claims.htu, url.toString())
                        const key = await webcrypto.subtle.importKey('jwk', header.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
                        assert.ok(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(signaturePart, 'base64url'), new TextEncoder().encode(`${headerPart}.${claimsPart}`)))
                        dashboardVerified = true
                        return new Response('<!doctype html><p>Signed in with verified device proof</p>', { headers: { 'Content-Type': 'text/html' } })
                    } catch {
                        return new Response('Device proof rejected', { status: 401 })
                    }
                }
                return new Response('Not found', { status: 404 })
            },
        })
        const origin = `https://127.0.0.1:${server.port}`
        process.env.SOCIAL_AUTH_ORIGIN = origin
        const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'allow' })
        try {
            const page = await context.newPage()
            page.setDefaultTimeout(15000)
            await page.goto(`${origin}/start`)
            await page.waitForFunction(() => Boolean(window.hanasandDeviceProofReady && navigator.serviceWorker.controller))
            await page.evaluate(async () => { await window.hanasandDeviceProofReady })
            await page.goto(`${origin}/api/auth/social/google/callback?code=synthetic&state=synthetic`)
            await page.waitForURL(`${origin}/dashboard`)
            assert.ok(dashboardVerified)
            assert.ok((await page.textContent('body'))?.includes('Signed in with verified device proof'))
            console.log(`${label}: Google callback -> cookie update -> worker sync -> signed dashboard passed.`)
        } finally {
            await context.close()
            server.stop(true)
        }
    }
} finally {
    await browser?.close()
    globalThis.fetch = originalFetch
    if (originalOrigin === undefined) delete process.env.SOCIAL_AUTH_ORIGIN
    else process.env.SOCIAL_AUTH_ORIGIN = originalOrigin
    if (originalIdentity === undefined) delete process.env.FRONTEND_IDENTITY_API
    else process.env.FRONTEND_IDENTITY_API = originalIdentity
    await rm(temporary, { recursive: true, force: true })
}
