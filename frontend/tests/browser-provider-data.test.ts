import { strict as assert } from 'node:assert'
import test from 'node:test'
import { selectToolCapture } from '../src/app/browser/browserProviderData'
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
