import { browserResultId } from './browserResultIdentity.ts'

export type BrowserNetwork = 'regular' | 'tor'

export type BrowserProviderRunResult = {
    status: 'clean' | 'suspicious' | 'blocked' | 'loading'
    label: string
}

export type BrowserRunRecord = {
    id: string
    target: string
    network: BrowserNetwork
    status: string
    startedAt: string
    checkCount?: number
    title?: string
    providerResults?: Record<string, BrowserProviderRunResult>
    reportUrl?: string
    resultId: string
}

export function rowToBrowserRunRecord(row: Record<string, any>): BrowserRunRecord {
    const reportToken = row.metadata?.reportToken
    return {
        id: String(row.id || ''),
        resultId: browserResultId(String(row.target || '')),
        target: String(row.target || ''),
        network: row.network === 'tor' ? 'tor' : 'regular',
        status: String(row.status || 'running'),
        startedAt: new Date(row.created_at || Date.now()).toISOString(),
        checkCount: Math.max(1, Number(row.check_count || 1)),
        title: String(row.title || ''),
        providerResults: providerResultsValue(row.metadata?.providerResults),
        reportUrl: reportToken ? browserReportViewerUrl(String(row.id || ''), String(reportToken)) : undefined,
    }
}

export function rowToBrowserHistoryRecord(row: Record<string, any>) {
    return {
        id: String(row.id || ''),
        resultId: browserResultId(String(row.target || '')),
        target: String(row.target || ''),
        network: row.network === 'tor' ? 'tor' as const : 'regular' as const,
        status: String(row.status || 'running'),
        startedAt: new Date(row.created_at || Date.now()).toISOString(),
        providerResults: providerResultsValue(row.provider_results),
    }
}

function providerResultsValue(value: unknown): Record<string, BrowserProviderRunResult> | undefined {
    if (!value || typeof value !== 'object') return undefined
    const out: Record<string, BrowserProviderRunResult> = {}
    for (const [key, result] of Object.entries(value as Record<string, any>)) {
        if (!/^[a-z0-9_-]+$/i.test(key) || !result || typeof result !== 'object') continue
        const status = ['clean', 'suspicious', 'blocked', 'loading'].includes(result.status) ? result.status : 'loading'
        const label = cleanText(result.label)
        if (label) out[key] = { status, label }
    }
    return Object.keys(out).length ? out : undefined
}

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function browserReportViewerUrl(id: string, token: string) {
    return `/sandbox/report?run=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`
}

export function buildStoredBrowserReport(selected: Record<string, any>, saved: any, events: Record<string, any>[], versions: Record<string, any>[]) {
    const captures: Record<string, any>[] = events.filter(event => event.type === 'frame' || event.type === 'tool_capture').map(event => ({
        ...event,
        kind: event.type === 'frame' ? 'page' : 'tool',
        label: event.type === 'frame' ? 'Screenshot' : event.name || 'Provider',
        image: event.image ? `data:image/jpeg;base64,${event.image}` : undefined,
    }))
    const logs = (provider: boolean) => events.filter(event => ['console', 'pageerror'].includes(event.type) && (event.source === 'provider') === provider)
        .map(event => `${event.name ? `[${event.name}] ` : ''}[${event.level || (event.type === 'pageerror' ? 'error' : 'log')}] ${event.text || event.message || ''}${event.url ? ` (${event.url}${event.line ? `:${event.line}` : ''})` : ''}`)
    const latest = [...events].reverse().find(event => event.networkSummary)?.networkSummary
    const latestSite = latest?.site
    const storedSite = [...events].reverse().find(event => event.networkSummary?.site?.ip === latestSite?.ip && event.networkSummary?.site?.country_code)?.networkSummary?.site
    const pageCaptures = captures.filter(capture => capture.kind === 'page')
    const providerCaptures = new Map<string, Record<string, any>>()
    for (const event of events.filter(event => event.type === 'tool_capture')) providerCaptures.set(event.id || event.name, event)
    const providerReports = [...providerCaptures.values()].filter(event => event.id !== 'webcrack' || event.deobfuscatedCode).map(event => ({
        tool: event.name || event.id,
        url: event.url,
        status: providerReportStatus(event.error),
        ...event.toolAnalysis,
        deobfuscatedCode: event.deobfuscatedCode,
        signals: event.toolAnalysis?.extractedSignals || [],
        error: event.error,
    }))
    return {
        ...saved,
        analystSummary: saved?.analystSummary || { narrative: `Loaded ${selected.target} and captured ${pageCaptures.length} screenshots.` },
        siteNetwork: (latestSite ? { ...latestSite, ...storedSite } : undefined) || saved?.siteNetwork || saved?.captures?.findLast((capture: any) => capture.networkSummary?.site)?.networkSummary.site,
        target: selected.target,
        finalUrl: captures.filter(capture => capture.kind === 'page').at(-1)?.url || saved?.finalUrl || selected.target,
        status: { ...saved?.status, run: selected.status },
        exportedAt: saved?.exportedAt || selected.created_at,
        captures: captures.length ? captures : saved?.captures || [],
        consoleEvents: events.length ? logs(false) : saved?.consoleEvents || [],
        providerConsoleEvents: events.length ? logs(true) : saved?.providerConsoleEvents || [],
        analystReport: { ...saved?.analystReport, ...(providerReports.length ? { providerReports } : {}), ...(latest ? { networkEvidence: {
            ...saved?.analystReport?.networkEvidence,
            requests: latest.requestCount, responses: latest.responseCount, domains: latest.uniqueDomainCount,
            blockedOrFailed: latest.blockedOrFailed, contactedDomains: latest.contactedDomains,
            downloads: latest.downloads, recentRequests: latest.recentRequests,
        } } : {}) },
        evidenceEvents: events.filter(event => !['frame', 'tool_capture', 'console', 'pageerror'].includes(event.type)),
        runId: selected.id,
        runs: versions.map(row => ({ id: row.id, startedAt: row.created_at, status: row.status })),
    }
}

export function providerReportStatus(error?: unknown) {
    if (!error) return 'Results'
    const message = String(error)
    if (/no (?:matching |existing )?(?:urlquery )?report|no existing (?:url )?analysis|item not found/i.test(message)) return 'No report'
    if (/captcha|access denied|denied browser access|forbidden|blocked/i.test(message)) return 'Access restricted'
    if (/pending|still running/i.test(message)) return 'Loading'
    if (/no verified report returned/i.test(message)) return 'No verified report'
    return 'Provider error'
}
