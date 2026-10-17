import { strict as assert } from 'node:assert'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import VMDetails from '../src/components/vms/vmDetails'
import VMHardware from '../src/components/vms/vmHardware'
import VMMetrics from '../src/components/vms/vmMetrics'
import VMNetwork from '../src/components/vms/vmNetwork'
import VMOverview from '../src/components/vms/vmOverview'
import manageVM from '../src/utils/vms/fetch/manage/manage'

test('VM actions encode instance names and preserve plain-text API failures', async () => {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=playwright-token; id=playwright-user' },
    })

    const originalFetch = globalThis.fetch
    let request: { url: string, authorization: string, id: string } | undefined
    try {
        globalThis.fetch = async (input, init) => {
            const headers = new Headers(init?.headers)
            request = {
                url: String(input),
                authorization: headers.get('authorization') || '',
                id: headers.get('id') || '',
            }
            return new Response('VM host is temporarily unavailable', { status: 503 })
        }

        assert.equal(await manageVM('folder/test vm', 'start'), 'VM host is temporarily unavailable')
        assert.match(request?.url || '', /\/vm\/folder%2Ftest%20vm\/start$/)
        assert.equal(request?.authorization, 'Bearer playwright-token')
        assert.equal(request?.id, 'playwright-user')
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})

test('VM detail cards share their shell and preserve titles and placeholders', () => {
    const vm = { name: 'test', status: 'stopped' } as VM
    const html = renderToStaticMarkup(<>
        <VMOverview vm={vm} details={null} />
        <VMHardware vm={vm} />
        <VMNetwork details={null} />
        <VMDetails vm={vm} details={null} />
        <VMMetrics metrics={[]} />
    </>)
    const panel = '<div class="w-full rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm"><h1 class="text-base font-medium text-ui-text">'
    for (const title of ['Overview', 'Hardware', 'Network', 'Details', 'Metrics']) assert(html.includes(`${panel}${title}</h1>`))
    assert.equal((html.match(/<div class="w-full rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm">/g) || []).length, 5)
    assert.equal(html.match(/Not reported/g)?.length, 7)
    assert(!html.includes('missing'))
})
