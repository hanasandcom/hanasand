import { expect, test } from 'bun:test'
import { browserResultId } from '../../src/utils/ws/browserResultIdentity.ts'
import { providerReportStatus, rowToBrowserRunRecord } from '../../src/utils/ws/browserRunViews.ts'

test('provider reports distinguish missing reports and denied access from errors', () => {
    expect(providerReportStatus()).toBe('Results')
    expect(providerReportStatus('No matching urlquery report was available. No clean verdict was inferred.')).toBe('No report')
    expect(providerReportStatus('VirusTotal has no existing report for this URL.')).toBe('No report')
    expect(providerReportStatus('urlquery denied browser access (HTTP 403).')).toBe('Access restricted')
    expect(providerReportStatus('Provider tab opened; verdict parsing is still running.')).toBe('Loading')
    expect(providerReportStatus('No verified report returned within the provider time limit.')).toBe('No verified report')
})

test('equivalent URLs have one stable identity; paths and queries remain distinct', () => {
    expect(browserResultId('https://vg.no/')).toBe('979b6683-b76b-87fc-95e8-02baa94ae619')
    expect(browserResultId('https://VG.no:443')).toBe(browserResultId('https://vg.no/'))
    expect(browserResultId('vg.no')).toBe(browserResultId('https://vg.no/'))
    expect(browserResultId('https://vg.no/a')).not.toBe(browserResultId('https://vg.no/b'))
    expect(browserResultId('https://vg.no/?a=1')).not.toBe(browserResultId('https://vg.no/?a=2'))
})

test('browser run view preserves report links and filters provider results', () => {
    const record = rowToBrowserRunRecord({
        id: 'run/one',
        target: 'https://vg.no',
        network: 'tor',
        status: 'running',
        created_at: '2026-09-23T12:00:00Z',
        check_count: 0,
        metadata: {
            reportToken: 'report token',
            providerResults: {
                virustotal: { status: 'suspicious', label: ' VirusTotal ' },
                urlquery: { status: 'unknown', label: 'URLQuery' },
                'invalid provider': { status: 'clean', label: 'Ignored' },
                empty: { status: 'clean', label: ' ' },
            },
        },
    })

    expect(record).toMatchObject({
        resultId: '979b6683-b76b-87fc-95e8-02baa94ae619',
        network: 'tor',
        checkCount: 1,
        reportUrl: '/sandbox/report?run=run%2Fone&token=report%20token',
        providerResults: {
            virustotal: { status: 'suspicious', label: 'VirusTotal' },
            urlquery: { status: 'loading', label: 'URLQuery' },
        },
    })
    expect(record.providerResults).not.toHaveProperty('invalid provider')
    expect(record.providerResults).not.toHaveProperty('empty')
})
