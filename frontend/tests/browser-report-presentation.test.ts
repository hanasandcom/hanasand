import { expect, test } from 'bun:test'
import { virusTotalVendorLabel } from '../src/app/browser/browserProviderData'
import { isDegradedNavigationError } from '../src/app/browser/browserRunData'
import { hasSuspiciousFindings, reportMarkdown } from '../src/app/browser/report/presentation'

test('Tor proxy navigation failures preserve provider checks instead of failing the run', () => {
    expect(isDegradedNavigationError('goto: net::ERR_SOCKS_CONNECTION_FAILED')).toBe(true)
    expect(isDegradedNavigationError('goto: net::ERR_PROXY_CONNECTION_FAILED')).toBe(true)
    expect(isDegradedNavigationError('Blocked unsafe sandbox target.')).toBe(false)
})

test('provider vendor labels handle zero, totals, and missing totals consistently', () => {
    expect(virusTotalVendorLabel({ vendorFlagged: 0, vendorTotal: 72 })).toBe('0/72')
    expect(virusTotalVendorLabel({ vendorFlagged: 3, vendorTotal: 72 })).toBe('3/72')
    expect(virusTotalVendorLabel({ vendorFlagged: 3 })).toBe('3 flagged')
})

test('clean reports omit actions and legacy review entries without removing evidence', () => {
    const clean = { analystReport: { providerReports: [{ vendorFlagged: 0, alertCount: 0 }], scriptArtifacts: [{ assessment: 'obfuscated' }] } }
    expect(hasSuspiciousFindings(clean)).toBe(false)
    const markdown = '# Report\nVerdict: Review required\n## Analyst review\n- Redirect observed\n## Resource URLs\n- https://example.com\n## Recommended actions\n- Keep the indicator list open\n## Network\n- requests: 4'
    const result = reportMarkdown(markdown, false)
    expect(result).not.toContain('review')
    expect(result).not.toContain('Recommended actions')
    expect(result).not.toContain('Keep the indicator')
    expect(result).toContain('## URLs\n- https://example.com')
    expect(result).toContain('## Network\n- requests: 4')
    expect(reportMarkdown('## Recommended actions\n- Filler', false)).toBe('')
})

test('actual detections keep relevant actions, never a review category', () => {
    for (const report of [
        { analystReport: { providerReports: [{ vendorFlagged: 1 }] } },
        { analystReport: { providerReports: [{ alertCount: 1 }] } },
        { captures: [{ evidence: { verdict: 'suspicious' } }] },
        { analystReport: { scriptArtifacts: [{ assessment: 'suspicious' }] } },
        { analystReport: { networkEvidence: { downloads: [{ virusTotal: { flagged: 1 } }] } } },
    ]) expect(hasSuspiciousFindings(report)).toBe(true)
    const result = reportMarkdown('## Review list\n- Flagged\n## Recommended actions\n- Inspect detected script', true)
    expect(result).not.toContain('Review list')
    expect(result).toContain('## Recommended actions\n- Inspect detected script')
})
