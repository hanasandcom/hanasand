import { strict as assert } from 'node:assert'
import test from 'node:test'
import { mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import VMDetails from '../src/components/vms/vmDetails'
import VMHardware from '../src/components/vms/vmHardware'
import VMMetrics from '../src/components/vms/vmMetrics'
import VMNetwork from '../src/components/vms/vmNetwork'
import VMOverview from '../src/components/vms/vmOverview'
import VMAccess from '../src/components/vms/vmAccess'
import manageVM from '../src/utils/vms/fetch/manage/manage'
import { latestVMMetrics } from '../src/utils/vms/metricPresentation'

mock.module('next/navigation', () => ({
    usePathname: () => '/vms/test/console',
    useRouter: () => ({ replace() {} }),
    useSearchParams: () => new URLSearchParams(),
}))
mock.module('@/components/organizations/workspaceProvider', () => ({ useWorkspace: () => ({ organizationId: '', loading: false }) }))
const { default: VmConsole } = await import('../src/components/vms/consoleClient')

test('VM actions encode instance names and preserve plain-text API failures', async () => {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=playwright%252Ftoken; id=playwright-user' },
    })

    const originalFetch = globalThis.fetch
    let attempts = 0
    let request: { url: string, authorization: string, id: string } | undefined
    try {
        globalThis.fetch = async (input, init) => {
            attempts++
            const headers = new Headers(init?.headers)
            request = {
                url: String(input),
                authorization: headers.get('authorization') || '',
                id: headers.get('id') || '',
            }
            return new Response('VM host is temporarily unavailable', { status: 503 })
        }

        assert.deepEqual(await manageVM('folder/test vm', 'start'), { ok: false, message: 'VM host is temporarily unavailable' })
        assert.match(request?.url || '', /\/vm\/folder%2Ftest%20vm\/start$/)
        assert.equal(request?.authorization, 'Bearer playwright%2Ftoken')
        assert.equal(request?.id, 'playwright-user')
        assert.equal(attempts, 1, 'a lifecycle POST must not be automatically replayed')
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})

test('browser VM actions use the same-origin cookie-authenticated backend proxy when cookies are not script-readable', async () => {
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {},
    })

    const originalFetch = globalThis.fetch
    let request: { url: string, authorization: string, id: string, credentials: RequestCredentials | undefined } | undefined
    try {
        globalThis.fetch = async (input, init) => {
            const headers = new Headers(init?.headers)
            request = {
                url: String(input),
                authorization: headers.get('authorization') || '',
                id: headers.get('id') || '',
                credentials: init?.credentials,
            }
            return Response.json({ message: 'VM started' })
        }

        assert.deepEqual(await manageVM('browser vm', 'start'), { ok: true, message: 'VM started' })
        assert.equal(request?.url, '/api/backend/vm/browser%20vm/start')
        assert.equal(request?.authorization, '')
        assert.equal(request?.id, '')
        assert.equal(request?.credentials, 'same-origin')
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'window')
    }
})

test('VM detail cards share their shell and preserve titles and placeholders', () => {
    const vm = { name: 'test', status: 'stopped' } as VM
    const html = renderToStaticMarkup(<>
        <VMOverview vm={vm} details={null} />
        <VMAccess vmName='test' connection={null} />
        <VMHardware vm={vm} />
        <VMNetwork details={null} />
        <VMDetails vm={vm} details={null} />
        <VMMetrics metrics={[]} />
    </>)
    const panel = '<div class="w-full rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm"><h1 class="text-base font-medium text-ui-text">'
    for (const title of ['Overview', 'Access', 'Hardware', 'Network', 'Details', 'Metrics']) assert(html.includes(`${panel}${title}</h1>`))
    assert.equal((html.match(/<div class="w-full rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm">/g) || []).length, 6)
    assert.equal(html.match(/Not reported/g)?.length, 7)
    for (const copy of [
        'Machine details reconnecting',
        'Refresh the VM to reload image, power state, and architecture details.',
        'Network telemetry reconnecting',
        'Refresh the VM to reload IP, interface, and profile details.',
        'Access details reconnecting',
        'Reloading SSH user, host, and certificate information automatically…',
    ]) assert(html.includes(copy))
    assert.equal((html.match(/border-ui-primary bg-ui-panel text-ui-text px-3 py-2 mt-3/g) || []).length, 3)

    const access = renderToStaticMarkup(<VMAccess vmName='test' connection={null} />)
    assert.match(access, /aria-label="VM access actions"/)
    assert.match(access, /Connect locally/)
    assert.match(access, /Show sudo password/)
    assert.match(access, /hidden items-center gap-2 lg:flex/)
    assert.match(access, /lg:hidden/)
    assert.match(access, /Each successful view is recorded and emailed to the VM owner\./)

    const accessError = renderToStaticMarkup(<VMAccess vmName='test' connection={null} error='You do not have permission to view access details.' />)
    assert(accessError.includes('Access details unavailable'))
    assert(accessError.includes('You do not have permission to view access details.'))
    assert(!html.includes('missing'))
})

test('VM hardware shows root disk capacity from the latest metric', () => {
    const vm = { name: 'test', limits_cpu: '1', limits_memory: '1GiB' } as VM
    const html = renderToStaticMarkup(<VMHardware vm={vm} diskTotalMb={4096} />)
    assert.match(html, /<h1 class="text-xs text-ui-primary">Disk<\/h1><h1 class="text-sm text-ui-text">4\.0 GB<\/h1>/)
})

test('VM metric selection uses the newest timestamp without mutating input', () => {
    const metrics = [
        { created_at: '2026-10-18T10:00:00Z', disk_total_mb: 2048 },
        { created_at: '2026-10-18T10:05:00Z', disk_total_mb: 4096 },
    ] as VMMetrics[]
    const originalOrder = [...metrics]

    assert.equal(latestVMMetrics(metrics)?.disk_total_mb, 4096)
    assert.deepEqual(metrics, originalOrder)
    assert.equal(latestVMMetrics([]), null)
})

test('console overview link keeps an accessible label without visible text', () => {
    const html = renderToStaticMarkup(<VmConsole name='test' />)
    assert.match(html, /<a[^>]+aria-label="Back to overview"[^>]+title="Back to overview"[^>]*>/)
    assert.match(html, /<a[^>]+aria-label="Back to overview"[^>]*><svg[^>]+aria-hidden="true"/)
    assert.doesNotMatch(html, /<a[^>]+Back to overview<\/a>/)
})

test('VM hardware preserves its placeholder when the latest metric has no disk capacity', () => {
    const vm = { name: 'test', limits_cpu: '1', limits_memory: '1GiB' } as VM
    const html = renderToStaticMarkup(<VMHardware vm={vm} diskTotalMb={latestVMMetrics([{ created_at: '2026-10-18T10:05:00Z', disk_total_mb: null } as VMMetrics])?.disk_total_mb} />)

    assert.match(html, /<h1 class="text-xs text-ui-primary">Disk<\/h1><h1 class="text-sm text-ui-text">Not reported<\/h1>/)
})
