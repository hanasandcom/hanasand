import { strict as assert } from 'node:assert'
import test from 'node:test'
import manageVM from '../src/utils/vms/fetch/manage/manage'
import postVM from '../src/utils/vms/fetch/postVM'
import { vmLifecycleProxyTimeoutMs } from '../src/utils/vms/proxyTimeout'

function setSessionCookie() {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=playwright-token; id=playwright-user' },
    })
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
