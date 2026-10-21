import { strict as assert } from 'node:assert'
import test from 'node:test'
import manageVM from '../src/utils/vms/fetch/manage/manage'
import postVM from '../src/utils/vms/fetch/postVM'
import suggestVmSetup from '../src/utils/vms/fetch/suggestVmSetup'
import { vmLifecycleProxyTimeoutMs, vmSetupPlanProxyTimeoutMs } from '../src/utils/vms/proxyTimeout'

function setSessionCookie() {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=playwright-token; id=playwright-user' },
    })
}

function setBrowserWindow() {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
}

test('VM lifecycle mutations get enough proxy time for the host operation', () => {
    for (const action of ['start', 'stop', 'restart', 'restore']) {
        assert.equal(vmLifecycleProxyTimeoutMs('POST', ['vm', 'example', action], 12000), 150000)
    }
    assert.equal(vmLifecycleProxyTimeoutMs('DELETE', ['vm', 'example'], 12000), 150000)
    assert.equal(vmLifecycleProxyTimeoutMs('GET', ['vm', 'example', 'metrics'], 12000), null)
    assert.equal(vmLifecycleProxyTimeoutMs('POST', ['organizations', 'example'], 12000), null)
    assert.equal(vmLifecycleProxyTimeoutMs('POST', ['vm', 'example', 'restart'], 200000), 200000)
})

test('VM setup planning gets enough proxy time for its model request', () => {
    assert.equal(vmSetupPlanProxyTimeoutMs('POST', ['vm', 'setup-plan'], 12000), 30000)
    assert.equal(vmSetupPlanProxyTimeoutMs('GET', ['vm', 'setup-plan'], 12000), null)
    assert.equal(vmSetupPlanProxyTimeoutMs('POST', ['vm', 'other'], 12000), null)
    assert.equal(vmSetupPlanProxyTimeoutMs('POST', ['vm', 'setup-plan'], 40000), 40000)
})

test('browser request aborts say the host may still be processing the VM action', async () => {
    setSessionCookie()
    const originalFetch = globalThis.fetch
    try {
        globalThis.fetch = async () => { throw new DOMException('The operation was aborted.', 'AbortError') }
        const result = await manageVM('slow-vm', 'restart')
        assert.equal(result.ok, false)
        if (!result.ok) {
            assert.match(result.message, /timed out/)
            assert.match(result.message, /may still be processing/)
            assert.doesNotMatch(result.message, /fetch is aborted/i)
        }
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})

test('backend proxy timeouts report uncertain VM action completion', async () => {
    setSessionCookie()
    const originalFetch = globalThis.fetch
    try {
        globalThis.fetch = async () => Response.json({ error: 'The backend service did not respond in time.' }, { status: 503 })
        const result = await manageVM('slow-vm', 'restart')
        assert.equal(result.ok, false)
        if (!result.ok) {
            assert.match(result.message, /may still be processing/)
            assert.match(result.message, /check its status/)
            assert.doesNotMatch(result.message, /did not respond in time/i)
        }
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})

test('VM creation timeouts tell users to refresh before submitting a possible duplicate', async () => {
    setSessionCookie()
    const originalFetch = globalThis.fetch
    try {
        globalThis.fetch = async () => { throw new DOMException('The operation was aborted.', 'AbortError') }
        const result = await postVM({ name: 'slow-vm' })
        assert.equal(result.status, 408)
        assert.match(result.message, /may still be provisioning/)
        assert.match(result.message, /refresh the list/)
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})

test('VM creation reports a browser network failure as unreachable VM service', async () => {
    setSessionCookie()
    const originalFetch = globalThis.fetch
    try {
        globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
        const result = await postVM({ name: 'hei' })
        assert.equal(result.status, 503)
        assert.match(result.message, /couldn’t reach the VM service/i)
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})

test('VM creation reports the status when an edge returns a non-JSON error', async () => {
    setSessionCookie()
    const originalFetch = globalThis.fetch
    try {
        globalThis.fetch = async () => new Response('<html>gateway failure</html>', { status: 502, headers: { 'content-type': 'text/html' } })
        const result = await postVM({ name: 'hei' })
        assert.equal(result.status, 502)
        assert.match(result.message, /error \(502\)/)
        assert.doesNotMatch(result.message, /gateway failure/i)
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})

test('browser VM creation uses the same-origin backend proxy', async () => {
    setSessionCookie()
    setBrowserWindow()
    const originalFetch = globalThis.fetch
    let requestUrl = ''
    try {
        globalThis.fetch = async (input) => {
            requestUrl = String(input)
            return Response.json({ name: 'hei' }, { status: 201 })
        }
        const result = await postVM({ name: 'hei' })
        assert.equal(result.status, 201)
        assert.equal(requestUrl, '/api/backend/vm')
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
        Reflect.deleteProperty(globalThis, 'window')
    }
})

test('setup suggestions use the same-origin backend proxy', async () => {
    setSessionCookie()
    setBrowserWindow()
    const originalFetch = globalThis.fetch
    let requestUrl = ''
    try {
        globalThis.fetch = async (input) => {
            requestUrl = String(input)
            return Response.json({ summary: 'Node.js with PostgreSQL', services: ['nodejs', 'postgresql'], website: null, minecraftServerType: null })
        }
        const result = await suggestVmSetup('Node.js and PostgreSQL')
        assert.equal(requestUrl, '/api/backend/vm/setup-plan')
        assert.deepEqual(result.services, ['nodejs', 'postgresql'])
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
        Reflect.deleteProperty(globalThis, 'window')
    }
})

test('VM creation preserves the organization permission response', async () => {
    setSessionCookie()
    const originalFetch = globalThis.fetch
    try {
        globalThis.fetch = async () => Response.json({ error: 'An organization owner or admin must create VMs.' }, { status: 403 })
        const result = await postVM({ name: 'cashflow-vm', organization_id: 'cashflow' })
        assert.equal(result.status, 403)
        assert.equal(result.message, 'An organization owner or admin must create VMs.')
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})
