import { strict as assert } from 'node:assert'
import test from 'node:test'
import { inferNetwork } from '../src/app/browser/browserValues'
import { browserSandboxRouteSources } from './helpers/browser-sandbox-route-sources'

test('canonical browser sandbox routes and starter profile contracts are wired', () => {
    assert(browserSandboxRouteSources.routeSource.includes('path: \'/sandbox\''), 'sandbox route metadata should use the canonical public route path.')
    assert(browserSandboxRouteSources.routeSource.includes('<BrowserPageClient initialData='), 'sandbox route should render the unified client.')
    assert(browserSandboxRouteSources.browserAliasSource.includes('redirect(\'/sandbox\')'), 'the old browser route should redirect to the canonical sandbox route.')
    assert(!browserSandboxRouteSources.fixtureExists('src/app/browser-obfuscated/page.tsx'), 'the browser obfuscation test fixture must not ship as a production route.')
    assert(!browserSandboxRouteSources.fixtureExists('src/app/browser-download/page.tsx'), 'the browser download test fixture must not ship as a production route.')
    assert(!browserSandboxRouteSources.fixtureExists('src/app/dev/vm-smoke/page.tsx'), 'the VM control test fixture must not ship as a production route.')
    assert(browserSandboxRouteSources.legacyBrowserSource.includes('redirect(\'/sandbox\')'), 'legacy regular sandbox route should redirect to the canonical sandbox route.')
    assert(browserSandboxRouteSources.legacyOnionSource.includes('redirect(\'/sandbox\')'), 'legacy onion route should redirect to the canonical sandbox route.')
    assert(browserSandboxRouteSources.clientSource.includes('Browser'), 'client should expose the URL-first browser surface.')
    assert(browserSandboxRouteSources.clientSource.includes('NEXT_PUBLIC_BROWSER_WS'), 'client should use the unified browser websocket endpoint.')
    assert(browserSandboxRouteSources.clientSource.includes('BrowserNetwork'), 'client should model Regular and Tor network modes.')
    assert(browserSandboxRouteSources.clientSource.includes('inferNetwork'), 'client should infer Tor for onion targets.')
    assert(browserSandboxRouteSources.clientSource.includes('BrowserFingerprint'), 'client should expose investigation metadata presets.')
    assert(browserSandboxRouteSources.clientSource.includes('SlidersHorizontal'), 'client should keep investigation metadata behind a compact filter control.')
    assert(browserSandboxRouteSources.clientSource.includes('VirusTotal'), 'default profile should include VirusTotal.')
    assert(browserSandboxRouteSources.clientSource.includes('urlquery'), 'default profile should include urlquery.')
    assert(browserSandboxRouteSources.clientSource.includes('WebCrack'), 'default profile should include WebCrack.')
    assert(browserSandboxRouteSources.clientSource.includes('data-screenshot-list'), 'client should expose captured screenshots as a timeline.')
    assert(browserSandboxRouteSources.clientSource.includes('>Summary</h2>'), 'client should expose analyst summary output.')
    assert(browserSandboxRouteSources.clientSource.includes('window.localStorage.setItem'), 'client should persist saved profiles locally.')
    assert(browserSandboxRouteSources.clientSource.includes('/api/backend/browser/profiles'), 'client should sync saved profiles through the authenticated backend proxy.')
    assert(browserSandboxRouteSources.clientSource.includes('ProfileToolEditor'), 'client should expose editable custom profile tool lists.')
    assert(browserSandboxRouteSources.clientSource.includes('Profiles synced to account'), 'client should surface account profile sync state.')
    assert(browserSandboxRouteSources.clientSource.includes('credentials:') && browserSandboxRouteSources.clientSource.includes('include'), 'client profile sync should include account cookies.')
    assert(browserSandboxRouteSources.clientSource.includes('Copyable indicators'), 'client should expose copyable indicator output.')
})

test('onion URLs with query strings and fragments use Tor', () => {
    assert.equal(inferNetwork('https://service.onion?view=latest'), 'tor')
    assert.equal(inferNetwork('http://service.onion:8080/#status'), 'tor')
    assert.equal(inferNetwork('https://example.com/?next=service.onion'), 'regular')
    assert.equal(inferNetwork('not a URL'), 'regular')
})
