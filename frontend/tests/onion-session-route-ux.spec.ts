import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { readBrowserClientSource } from './helpers/browser-client-source'

const root = process.cwd()

test('legacy onion and regular sandbox routes redirect to the unified browser workspace', async () => {
    const onionRouteSource = await readFile(path.join(root, 'src/app/solutions/onion-session/page.tsx'), 'utf8')
    const regularRouteSource = await readFile(path.join(root, 'src/app/browser-sandbox/page.tsx'), 'utf8')
    const browserRouteSource = await readFile(path.join(root, 'src/app/browser/page.tsx'), 'utf8')
    const sandboxRouteSource = await readFile(path.join(root, 'src/app/sandbox/page.tsx'), 'utf8')
    const browserClientSource = readBrowserClientSource(root)
    const headerSource = await readFile(path.join(root, 'src/components/header/header.tsx'), 'utf8')
    const footerSource = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')

    assert(onionRouteSource.includes('redirect(\'/sandbox\')'))
    assert(regularRouteSource.includes('redirect(\'/sandbox\')'))
    assert(browserRouteSource.includes('redirect(\'/sandbox\')'))
    assert(sandboxRouteSource.includes('<BrowserPageClient initialData={initialData} />'))
    assert(headerSource.includes('href: \'/sandbox\''))
    assert(footerSource.includes('href: \'/sandbox\''))

    assert(browserClientSource.includes('Browser'))
    assert(browserClientSource.includes('BrowserNetwork'))
    assert(browserClientSource.includes('inferNetwork'))
    assert(browserClientSource.includes('BrowserFingerprint'))
    assert(browserClientSource.includes('SlidersHorizontal'))
    assert(browserClientSource.includes('id=\'sandbox-url\''))
    assert(browserClientSource.includes('>Summary</h2>'))
    assert(browserClientSource.includes('HistoryPanel'))
    assert(!browserClientSource.includes('This page is not available'))
})

test('unified browser app chrome uses shared theme tokens', async () => {
    const clientSource = readBrowserClientSource(root)
    const jsxChrome = clientSource
        .replace(/context\.(?:fillStyle|strokeStyle)\s*=\s*'#[^']+'/g, '')
        .replace(/drawRoundedRect\([\s\S]+?#[\s\S]+?\)/g, '')

    assert(jsxChrome.includes('bg-ui-canvas'))
    assert(jsxChrome.includes('border-ui-border'))
    assert(jsxChrome.includes('text-ui-text'))
    assert(jsxChrome.includes('bg-ui-primary'))
    assert(!/\b(?:border|bg|text|shadow|hover:bg|hover:border|focus:ring|accent)-\[#/.test(jsxChrome))
    assert(!/\b(?:red|orange|amber|emerald|slate|gray)-[0-9]/.test(jsxChrome))
})
