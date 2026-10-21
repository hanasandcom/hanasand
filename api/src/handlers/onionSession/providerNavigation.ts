import { domainFromUrl } from './networkTelemetry.ts'

export function isWebCrackTool(tool: { id?: string; name?: string; url?: string }, resolvedUrl: string) {
    return /web\s*crack|webcrack/i.test(`${tool.id || ''} ${tool.name || ''} ${tool.url || ''} ${resolvedUrl}`)
}

export function isVirusTotalTool(tool: { id?: string; name?: string; url?: string }, resolvedUrl = '') {
    return /virus\s*total|virustotal/i.test(`${tool.id || ''} ${tool.name || ''} ${tool.url || ''} ${resolvedUrl}`)
}

export function isUrlQueryTool(tool: { id?: string; name?: string; url?: string }, resolvedUrl = '') {
    return /urlquery/i.test(`${tool.id || ''} ${tool.name || ''} ${tool.url || ''} ${resolvedUrl}`)
}

export function officialProviderKind(resolvedUrl: string) {
    const host = domainFromUrl(resolvedUrl)
    if (host === 'virustotal.com' || host.endsWith('.virustotal.com')) return 'virustotal'
    if (host === 'urlquery.net' || host.endsWith('.urlquery.net')) return 'urlquery'
    return ''
}

export function providerStartUrl(tool: { id?: string; name?: string; url?: string }, resolvedUrl: string, target: string) {
    const kind = officialProviderKind(resolvedUrl)
    if (kind === 'virustotal') return `https://www.virustotal.com/gui/url/${virusTotalUrlId(target)}`
    if (kind === 'urlquery') return `https://urlquery.net/search/reports?q=${encodeURIComponent(urlQuerySearchTarget(target))}`
    return resolvedUrl
}

function urlQuerySearchTarget(target: string) {
    try {
        const url = new URL(target)
        // URLQuery indexes the submitted URL, including its scheme. Do not
        // rewrite HTTP onion targets to HTTPS: that misses their existing reports.
        return url.href
    } catch { return target }
}

export function virusTotalUrlId(target: string) {
    try {
        return Buffer.from(new URL(target).href).toString('base64url')
    } catch {
        return Buffer.from(target).toString('base64url')
    }
}

