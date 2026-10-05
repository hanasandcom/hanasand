// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('scraper control preserves auth and reports unavailable health as failure', async () => {
    const source = await readFile(new URL('../../api/src/handlers/ti/scraperControl.ts', import.meta.url), 'utf8')

    assert.match(source, /tokenWrapper\(request, reply\)/)
    assert.match(source, /if \(!auth\.valid \|\| !auth\.id\)/)
    assert.match(source, /authorization: `Bearer \$\{actor\.token\}`/)
    assert.match(source, /tenantId: 'default'/)
    assert.match(source, /const scraperUnavailable = !health\.ok/)
    assert.match(source, /ok: !scraperUnavailable/)
    assert.match(source, /reply\.code\(scraperUnavailable \? 503 : 200\)/)
})
