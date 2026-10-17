import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { assertGeneratedOutputLineCap } from '../scripts/generatedOutputLineCap.mjs'
import { generatedSearchRoutes } from '../src/utils/routes/generatedSearchRoutes'
import { actorItems, authorizedWatchlistItems, caseItem, directThreatItem, watchlistItems } from '../src/components/header/siteSearch/searchData'

test('generated route catalog is unique, ordered, canonical, and within the source cap', async () => {
    const hrefs = generatedSearchRoutes.map(route => route.href)
    const ids = generatedSearchRoutes.map(route => route.id)
    const generatedSource = await readFile(new URL('../src/utils/routes/generatedSearchRoutes.ts', import.meta.url), 'utf8')
    assert.ok(generatedSource.trimEnd().split(/\r?\n/).length <= 200)
    assert.equal(new Set(hrefs).size, hrefs.length)
    assert.equal(new Set(ids).size, ids.length)
    assert.deepEqual(hrefs, [...hrefs].sort((first, second) => first.localeCompare(second)))
    for (const route of generatedSearchRoutes) {
        assert.equal(route.id, `route:${route.href}`)
        assert.ok(route.title.length > 0)
        assert.ok(route.detail.length > 0)
    }
    for (const href of ['/dashboard/cases', '/dashboard/findings/cases', '/watchlists', '/ti/profiles']) assert.ok(hrefs.includes(href))
    for (const href of ['/cases', '/dashboard/findings/watchlists', '/dashboard/ti/enrichment', '/browser', '/browser/report', '/browser-sandbox', '/sandbox/report', '/dashboard/system/ssh-keys']) {
        assert.ok(!hrefs.includes(href), `${href} should not appear as a search route`)
    }
})

test('generated output cap guard rejects oversized files before writing', () => {
    assert.equal(assertGeneratedOutputLineCap('one\ntwo\n', 'routes.ts'), 2)
    assert.throws(() => assertGeneratedOutputLineCap(`${'line\n'.repeat(201)}`, 'routes.ts'), /201 lines \(limit 200\): routes\.ts/)
})

test('header search does not invent an actor result for unavailable or empty TI responses', () => {
    assert.deepEqual(actorItems({ query: 'APT29', status: 'unavailable', mode: 'unavailable' }), [])
    assert.deepEqual(actorItems({}), [])
    assert.deepEqual(actorItems({ query: 'APT29', status: 'ready' }), [])
})

test('header search may link an explicit actor only from a ready response', () => {
    assert.deepEqual(actorItems({ query: 'APT29', actor: 'APT29', status: 'ready' }), [{
        id: 'actor:APT29',
        title: 'APT29',
        detail: 'Threat actor profile',
        href: '/ti/APT29',
    }])
    assert.deepEqual(directThreatItem('apt42', [{
        id: 'actor:APT42',
        title: 'APT42',
        detail: 'Threat actor profile · Russia-linked espionage group',
        href: '/ti/apt42',
    }]), {
        id: 'actor:APT42',
        title: 'APT42',
        detail: 'Threat actor profile · Russia-linked espionage group',
        href: '/ti/apt42',
    })
    assert.equal(directThreatItem('apt42'), null)
    assert.equal(directThreatItem(''), null)
})

test('header case results never display a raw organization identifier', () => {
    assert.deepEqual(caseItem({ id: 'case-1', title: 'Incident', status: 'open', organizationId: 'tenant-secret', summary: 'Review required.' }), {
        id: 'case:case-1',
        title: 'Incident',
        detail: 'open · Review required.',
        href: '/cases/case-1',
    })
})

test('header watchlist results normalize both string and object terms', () => {
    assert.deepEqual(watchlistItems({ watchlists: [{ terms: ['apt29', { value: 'example.com' }] }] }), [
        { id: 'watch:apt29', title: 'apt29', detail: 'Monitored entity', href: '/watchlists' },
        { id: 'watch:example.com', title: 'example.com', detail: 'Monitored entity', href: '/watchlists' },
    ])
})

test('header search hides retained watchlist results after authentication ends', () => {
    const items = watchlistItems({ watchlists: [{ terms: ['private.example'] }] })
    assert.equal(authorizedWatchlistItems(true, items), items)
    assert.deepEqual(authorizedWatchlistItems(false, items), [])
})
