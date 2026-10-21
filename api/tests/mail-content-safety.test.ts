import { describe, expect, test } from 'bun:test'
import { blobResponsePolicy, contentDispositionFilename } from '../src/utils/mail/blobResponsePolicy.ts'
import { canonicalRemoteUrl, extractRemoteUrls } from '../src/utils/mail/urlReputation.ts'

describe('mail content safety', () => {
    test('only signature-verified raster images remain inline', () => {
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        const image = blobResponsePolicy('image/png', 'preview.png', png)
        expect(image.contentType).toBe('image/png')
        expect(image.contentDisposition).toContain('inline;')

        for (const type of ['image/svg+xml', 'text/html', 'application/pdf', 'image/png']) {
            const policy = blobResponsePolicy(type, 'unsafe.svg', new Uint8Array([0x3c, 0x73, 0x76, 0x67]))
            expect(policy.contentType).toBe('application/octet-stream')
            expect(policy.contentDisposition).toContain('attachment;')
            expect(policy.nosniff).toBe('nosniff')
            expect(policy.contentSecurityPolicy).toContain('sandbox')
        }
    })

    test('content disposition removes path separators and control characters', () => {
        const value = contentDispositionFilename('../bad\r\nname.html')
        expect(value).not.toContain('\r')
        expect(value).not.toContain('\n')
        expect(value).not.toContain('../')
        expect(value).toContain('filename*=UTF-8\'\'')
    })

    test('remote URL canonicalization drops fragments and refuses unsafe schemes or credentials', () => {
        const first = canonicalRemoteUrl('HTTPS://Example.COM:443/pixel?a=1#secret')
        const second = canonicalRemoteUrl('https://example.com/pixel?a=1')
        expect(first).toEqual(second)
        expect(canonicalRemoteUrl('javascript:alert(1)')).toBeNull()
        expect(canonicalRemoteUrl('https://user:pass@example.com/pixel')).toBeNull()
    })

    test('extracts unique remote image URLs from message HTML', () => {
        const remote = extractRemoteUrls('<img src="https://example.com/a.png#x"><img src="https://example.com/a.png"><img src="cid:local">')
        expect(remote).toHaveLength(1)
        expect(remote[0]?.url).toBe('https://example.com/a.png')
    })
})
