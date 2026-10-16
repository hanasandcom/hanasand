import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildReadUrl } from '../src/app/dashboard/ti/timeliness/data'

test('binds tenant timeliness reads and writes to verified organization membership', () => {
    const route = readFileSync(new URL('../src/app/api/ti/timeliness/route.ts', import.meta.url), 'utf8')
    const auth = readFileSync(new URL('../src/utils/proxy/requireApiSession.ts', import.meta.url), 'utf8')

    assert.match(route, /requireApiSession\(request\)/)
    assert.match(auth, /canViewHanasandInternalRoute\(request\.method, request\.nextUrl\.pathname\)/)
    assert.match(auth, /validation\.canViewInternalPages/)
    assert.doesNotMatch(route, /session\.identity\.roles|system_admin/)
})

test('encodes tenant scope in client reads and scopes global access through Hanasand membership', () => {
    const route = readFileSync(new URL('../src/app/api/ti/timeliness/route.ts', import.meta.url), 'utf8')
    const url = new URL(buildReadUrl({ scope: 'tenant', tenantId: ' org-1 ', status: '', query: '' }), 'https://hanasand.test')

    assert.equal(url.searchParams.get('scope'), 'tenant')
    assert.equal(url.searchParams.get('tenantId'), 'org-1')
    assert.match(route, /requireApiSession\(request\)/)
})
