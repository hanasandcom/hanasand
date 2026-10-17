import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { isActiveCaseRequest, isCurrentCaseGeneration, requestCaseJson } from '../src/app/dashboard/cases/caseRequest'

describe('case request helpers', () => {
    it('keeps JSON requests uncached and forwards method, body, headers, and signal', async () => {
        const originalFetch = globalThis.fetch
        const controller = new AbortController()
        let request: { url: string, init: RequestInit } | null = null
        globalThis.fetch = (async (url, init) => {
            request = { url: String(url), init: init || {} }
            return Response.json({ items: [] })
        }) as typeof fetch

        try {
            const payload = await requestCaseJson<{ items: unknown[] }>('/api/backend/cases/repositories?organizationId=org-1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repositoryUrl: 'https://git.example.test/team/repo' }),
                signal: controller.signal,
            }, 'Could not load repository integration.')

            assert.deepEqual(payload, { items: [] })
            assert.equal(request?.url, '/api/backend/cases/repositories?organizationId=org-1')
            assert.equal(request?.init.cache, 'no-store')
            assert.equal(new Headers(request?.init.headers).get('Content-Type'), 'application/json')
            assert.equal(request?.init.method, 'POST')
            assert.equal(request?.init.body, JSON.stringify({ repositoryUrl: 'https://git.example.test/team/repo' }))
            assert.equal(request?.init.signal, controller.signal)
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    it('preserves strict-string and truthy error payload handling', async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = (async () => Response.json({ error: 7 }, { status: 400 })) as typeof fetch

        try {
            await assert.rejects(requestCaseJson('/api/cases', undefined, 'Repository fallback'), /Repository fallback/)
            await assert.rejects(requestCaseJson('/api/cases', undefined, 'Commit fallback', 'truthy'), /7/)
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    it('blocks stale and aborted updates while allowing current requests', () => {
        const controller = new AbortController()

        assert.equal(isCurrentCaseGeneration(4, 4), true)
        assert.equal(isCurrentCaseGeneration(5, 4), false)
        assert.equal(isActiveCaseRequest(4, 4, controller.signal), true)
        assert.equal(isActiveCaseRequest(5, 4, controller.signal), false)
        controller.abort()
        assert.equal(isActiveCaseRequest(4, 4, controller.signal), false)
    })
})
