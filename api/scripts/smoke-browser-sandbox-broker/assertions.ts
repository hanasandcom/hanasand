import assert from 'node:assert/strict'
import type { BrokerPayload } from './types.ts'

export function assertFrameEvidence(
    pageFrames: BrokerPayload[],
    payloadDomain: string,
    downloadBody: string,
    downloadHash: string,
) {
    assert(pageFrames.some(payload => payload.reason === 'domcontentloaded'), 'captures DOM-ready browser state')
    assert(pageFrames.some(payload => payload.reason === 'load'), 'captures loaded browser state')
    assert(pageFrames.every(payload => !payload.width || payload.height === Math.round(payload.width * 9 / 16)), 'browser frames stay 16:9')
    assert(pageFrames.some(payload => payload.url?.endsWith('/start')), 'captures initial URL before redirect')
    assert(pageFrames.some(payload => payload.url?.endsWith('/final')), 'captures final URL after redirect')
    assert(pageFrames.some(payload => (payload.image || '').length > 1000), 'captures non-empty screenshots')
    assert(pageFrames.some(payload => payload.frameQuality?.looksBlank === false && (payload.frameQuality.visibleTextLength || 0) > 20 && (payload.frameQuality.elementCount || 0) > 5), 'captures rendered non-blank frame quality metadata')
    assert(pageFrames.some(payload => payload.networkSummary?.recentRequests?.some(request => request.status === 200 && request.method === 'GET' && request.host === '127.0.0.1' && request.mimeType?.includes('text/html') && request.durationMs !== undefined && request.initiator)), 'exposes analyst-grade network request columns')
    assert(pageFrames.some(payload => payload.networkSummary?.downloads?.some(download => download.fileName === 'invoice-payload.bin' && download.bytes === downloadBody.length && download.sha256 === downloadHash && download.hashStatus === 'hashed_and_deleted')), 'hashes downloaded files and reports deletion status')

    const initialEvidence = pageFrames.find(payload => payload.url?.endsWith('/start') && payload.evidence?.obfuscatedScripts?.length)?.evidence
    const evidenceIndicators = pageFrames.flatMap(payload => [
        ...(payload.evidence?.indicators?.domains || []),
        ...(payload.evidence?.indicators?.ips || []),
        ...(payload.evidence?.indicators?.urls || []),
    ]).map(item => item.toLowerCase())
    assert(!evidenceIndicators.includes('document.createelement') && !evidenceIndicators.includes('object.assign') && !evidenceIndicators.includes('el.style'), 'does not promote generic DOM/API strings to indicators')
    assert(initialEvidence?.obfuscatedScripts?.length, 'extracts obfuscated script candidates')
    assert(initialEvidence?.deobfuscationTasks?.some(task => task.assessment === 'suspicious'), 'summarizes suspicious decoded script')
    assert(initialEvidence?.deobfuscationTasks?.some(task => task.indicators?.domains?.includes(payloadDomain)), 'decoded script exposes second-stage domain')
    assert(initialEvidence?.threatAssociations?.some(item => item.name === 'LockBit'), 'extracts actor/malware context from rendered evidence')
    assert(initialEvidence?.indicators?.domains?.includes('credential.example.test'), 'extracts form-action domain indicators')
}

export function assertProviderCaptures(payloads: BrokerPayload[], ready?: BrokerPayload) {
    const vt = payloads.find(payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'virustotal' && payload.toolAnalysis.vendorFlagged !== undefined)
    assert(!payloads.some(payload => payload.url?.includes('/unexpected-provider-navigation')), 'Cookie dismissal must not activate ordinary links with blind clicks or keyboard shortcuts')
    assert.equal(vt?.toolAnalysis?.vendorFlagged, 12)
    assert.equal(vt?.toolAnalysis?.vendorTotal, 94)
    assert.equal(vt?.toolAnalysis?.communityCommentCount, 3)
    assert.deepEqual(vt?.toolAnalysis?.communityComments, [])
    assert((vt?.image || '').length > 1000, 'VirusTotal parsed capture includes a screenshot')

    const urlquery = payloads.find(payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'urlquery' && payload.toolAnalysis.alertCount !== undefined)
    assert.equal(urlquery?.toolAnalysis?.alertCount, 4)
    assert.equal(urlquery?.toolAnalysis?.communityCommentCount, undefined, 'provider summaries are not miscounted as community comments')
    assert((urlquery?.image || '').length > 1000, 'urlquery parsed capture includes a screenshot')
    assert(!urlquery?.evidence?.comments?.some(comment => /<[^>]+>/.test(comment)), 'provider comments do not leak raw HTML into analyst summaries')
    assert(!/<[^>]+>/.test(urlquery?.toolAnalysis?.communitySummary || ''), 'provider community summary does not leak raw HTML into analyst summaries')

    const webcrack = payloads.find(payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'webcrack' && payload.webcrackLoad?.loaded === true)
    assert.equal(webcrack?.webcrackLoad?.loaded, true)
    assert((webcrack?.webcrackLoad?.sampleBytes || 0) > 40, 'loads extracted obfuscated sample into WebCrack fixture')
    for (const capture of [vt, urlquery, webcrack]) {
        assert(capture?.receivedAt && ready?.receivedAt && capture.receivedAt - ready.receivedAt <= 25_000, `${capture?.toolAnalysis?.toolKind || 'provider'} loaded within the provider smoke budget after browser ready`)
    }
}
