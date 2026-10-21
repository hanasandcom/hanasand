import { strict as assert } from 'node:assert'
import test from 'node:test'
import { providerDetail, providerStatus, providerTabStatus, selectToolCapture } from '../src/app/browser/browserProviderData'
import type { Capture, SandboxTool } from '../src/app/browser/types'

const tool: SandboxTool = { id: 'virustotal', name: 'VirusTotal', url: 'https://virustotal.com/{url}' }

function capture(id: string, overrides: Partial<Capture> = {}): Capture {
    return {
        id,
        kind: 'tool',
        label: 'VirusTotal',
        url: 'https://virustotal.com/gui/search/example.com',
        target: 'https://example.com',
        capturedAt: '2026-10-17T00:00:00.000Z',
        ...overrides,
    }
}

test('tool capture selection preserves parsed-result and image priority', () => {
    const pendingImage = capture('pending', { image: 'pending.png', error: 'provider_navigation_pending' })
    const plainImage = capture('image', { image: 'image.png' })
    const parsed = capture('parsed', { toolAnalysis: { toolKind: 'virustotal', vendorFlagged: 0 } })
    const parsedImage = capture('parsed-image', { image: 'result.png', toolAnalysis: { toolKind: 'virustotal', vendorFlagged: 0 } })

    assert.equal(selectToolCapture([pendingImage, plainImage, parsed, parsedImage], tool), parsedImage)
    assert.equal(selectToolCapture([pendingImage, plainImage, parsed], tool), parsed)
    assert.equal(selectToolCapture([pendingImage, plainImage], tool), plainImage)
})

test('tool capture selection filters by target host and retains the first pending fallback', () => {
    const otherTarget = capture('other-target', {
        target: 'https://other.example',
        image: 'other.png',
        toolAnalysis: { toolKind: 'virustotal', vendorFlagged: 0 },
    })
    const pending = capture('pending-only', { error: 'provider_navigation_pending' })

    assert.equal(selectToolCapture([otherTarget, pending], tool, 'https://example.com/path'), pending)
})

test('provider tabs distinguish missing reports from access failures or unavailable results', () => {
    const missing = capture('missing', { error: 'No matching urlquery report was available for the submitted URL. No clean verdict was inferred.' })
    assert.equal(providerStatus(missing), 'No report')
    assert.equal(providerTabStatus(missing), 'no report')
    assert.equal(providerDetail(undefined, missing), 'No existing report was found. No verdict was returned.')

    const noVirusTotalReport = capture('vt-missing', { error: 'VirusTotal has no existing report for this URL. No verdict was returned.' })
    assert.equal(providerStatus(noVirusTotalReport), 'No report')
    assert.equal(providerTabStatus(noVirusTotalReport), 'no report')

    const denied = capture('denied', { error: 'urlquery denied browser access to this report (HTTP 403). No verdict was returned.' })
    assert.equal(providerStatus(denied), 'Access restricted')
    assert.equal(providerTabStatus(denied), 'blocked')

    const unverified = capture('unverified', { error: 'No verified report returned for the submitted URL within the provider time limit.' })
    assert.equal(providerStatus(unverified), 'No verified report')
    assert.equal(providerTabStatus(unverified), 'no verified report')
})
