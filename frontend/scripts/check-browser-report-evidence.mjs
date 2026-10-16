import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const liveClient = readSource('src/app/browser/pageClient.tsx')
const exportSource = readSource('src/app/browser/browserExport.ts')
const analystSummarySource = readSource('src/app/browser/browserAnalystSummary.ts')
const evidenceWorkspaceSource = readSource('src/app/browser/components/EvidenceWorkspace.tsx')
const browserWorkspaceSource = readSource('src/app/browser/components/BrowserWorkspace.tsx')
const runHistorySource = readSource('src/app/browser/components/RunHistoryPanel.tsx')
const analystBriefSource = readSource('src/app/browser/browserBrief.ts')
const reportClient = readSource('src/app/browser/report/pageClient.tsx')
const backendProxy = readSource('src/app/api/backend/[...path]/route.ts')

for (const token of [
    'function buildExportReport',
    'function buildShareableAnalystReport',
    'providerReports',
    'networkEvidence',
    'finalUrl',
    'redirectChain',
    'urlStates',
    'peerSummary',
    'downloads',
    'scriptArtifacts',
    'resourceUrls',
    'threatAssociations',
    'recommendedActions',
    'markdown',
]) {
    assertIncludes(exportSource, token, `browser export must preserve ${token}`)
}

assertIncludes(exportSource, 'networkPeerSummary(latestNetwork)', 'browser export must derive DNS/IP/certificate peer evidence')
assertIncludes(exportSource, '## Network', 'markdown export must include network evidence')
assertIncludes(exportSource, '## Script artifacts', 'markdown export must include script evidence')
assertIncludes(exportSource, '## Indicators', 'markdown export must include copyable indicators')
assertIncludes(evidenceWorkspaceSource, 'Statistics', 'live browser workspace must summarize analyst evidence before raw drilldown')
assertIncludes(evidenceWorkspaceSource, 'Final URL', 'live browser workspace must expose final URL')
assertIncludes(evidenceWorkspaceSource, 'DNS / IP / certificate peers', 'live browser workspace must expose peer/certificate evidence')
assertIncludes(evidenceWorkspaceSource, 'Hashed downloads', 'live browser workspace must expose download hash evidence')
assertIncludes(evidenceWorkspaceSource, 'Script hashes', 'live browser workspace must expose script hash evidence')
assertIncludes(evidenceWorkspaceSource, 'Copyable indicators', 'live browser workspace must expose IOC count')
assertIncludes(browserWorkspaceSource, 'relative w-full overflow-hidden', 'live browser viewport must remain full-width and contain its content')
assertIncludes(browserWorkspaceSource, 'aspectRatio: `${viewportFrame.width} / ${viewportFrame.height}`', 'browser viewport must follow decoded dimensions without letterboxing')
assertIncludes(exportSource, 'deobfuscatedCode: capture.deobfuscatedCode', 'browser export must preserve deobfuscated code')
assertIncludes(exportSource, 'consoleEvents: input.consoleEvents', 'page console output must be separated from broker activity')
assert.ok(!liveClient.includes('title=\'Activity\''), 'broker activity must not clutter the evidence panels')
assertIncludes(analystSummarySource, 'virusTotalVendorLabel', 'VirusTotal labels must avoid broken 0/? totals')
assertIncludes(analystSummarySource, 'ANALYSIS_TOOL_DOMAINS', 'copyable indicators must exclude analysis provider URLs')
assertIncludes(analystBriefSource, '.replace(/<[^>]+>/g, \' \')', 'analyst evidence excerpts must strip leaked HTML tags')

for (const token of [
    'Saved run',
    'Summary',
    'URL timeline',
    'Providers',
    'Screenshots',
    'Network evidence',
    'Script artifacts',
    'Threat context',
    'Indicators',
]) {
    assertIncludes(reportClient, token, `saved browser report must render ${token}`)
}

assert.ok(!runHistorySource.includes('RunDetailModal'), 'history must not retain its removed popup')
assertIncludes(runHistorySource, 'href={`/sandbox/${run.resultId}`}', 'history rows must link to stable result pages')
assertIncludes(backendProxy, 'pathSegments[1] === \'results\'', 'anonymous results still pass through to API ownership checks')
assertIncludes(reportClient, '<NetworkTable', 'saved report must use the unified network table')
assertIncludes(reportClient, '<ReportExport report={report}', 'exports must retain the complete report evidence')
assertIncludes(backendProxy, 'anonymousAllowed', 'browser run reports must be saveable without console auth')
assertIncludes(backendProxy, 'browser', 'anonymous backend proxy exception must stay scoped to browser routes')
assertIncludes(backendProxy, 'runs', 'anonymous backend proxy exception must stay scoped to browser runs')

console.log('[browser-report-evidence] browser report evidence contract passed')

function readSource(relativePath) {
    return readFileSync(path.join(root, relativePath), 'utf8')
}

function assertIncludes(source, needle, message) {
    assert.ok(source.includes(needle), `${message}: missing ${JSON.stringify(needle)}`)
}
