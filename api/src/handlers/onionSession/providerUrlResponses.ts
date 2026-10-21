import type { Page } from 'playwright'
import { providerSummaryText, providerCommunityComments, uniqueStrings, providerResponseUrl } from './providerText.ts'

export async function firstUrlQueryReportUrl(page: Page, target: string) {
    const links = await page.evaluate(() => Array.from(document.links)
        .filter(item => /^https:\/\/urlquery\.net\/report\/[a-f0-9-]{24,}$/i.test(item.href))
        .map(item => ({ url: item.href, target: item.textContent?.trim() || '' }))).catch(() => [])
    return links.find(item => urlQueryTargetMatches(item.target, target))?.url || ''
}

export function urlQueryTargetMatches(value: string, target: string) {
    const normalize = (input: string) => {
        try {
            const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
            return `${url.hostname.replace(/^www\./, '')}:${url.port}${url.pathname}${url.search}`
        } catch { return '' }
    }
    try {
        if (/^https?:\/\//i.test(value)) {
            const submitted = new URL(value)
            const requested = new URL(target)
            const sameOnion = submitted.hostname.endsWith('.onion') && submitted.hostname === requested.hostname
            if (submitted.protocol !== requested.protocol && !sameOnion) return false
        }
    } catch { return false }
    return Boolean(value && target && normalize(value) && normalize(value) === normalize(target))
}

export function urlQueryReportMatchesTarget(reportText: string, target: string) {
    const reported = reportText.match(/\bSubmitted URL\s+(\S+)/i)?.[1]
        || reportText.match(/\bURL\s+(\S+)\s+Finishing URL\b/i)?.[1]
    return Boolean(reported && urlQueryTargetMatches(reported, target))
}

// Keep the URL object's result, not scores for its serving IP or parent domain.
export function virusTotalUrlResponse(body: string, target: string) {
    try {
        const { data } = JSON.parse(body)
        if (data?.type !== 'url' || new URL(data.attributes?.url).href !== new URL(target).href) return ''
        const stats = data.attributes?.last_analysis_stats
        if (!stats || !Object.values(stats).every(value => Number.isInteger(value) && Number(value) >= 0)) return ''
        const summary = providerSummaryText(JSON.stringify({ last_analysis_stats: stats }), 'virustotal')
        if (!summary) return ''
        const date = Number(data.attributes.last_analysis_date)
        return [summary, Number.isFinite(date) && date > 0 ? `Existing VirusTotal analysis: ${new Date(date * 1000).toISOString()}.` : ''].filter(Boolean).join('\n')
    } catch { return '' }
}

export function collectProviderResponses(page: Page, toolName: string, target: string) {
    const bodies: string[] = []
    let verifiedResult = ''
    page.on('response', response => {
        const url = response.url()
        const request = response.request()
        if (request.isNavigationRequest() && request.frame() === page.mainFrame() && !response.ok()) {
            verifiedResult = providerHttpAccessIssue(toolName, response.status())
            return
        }
        if (!providerResponseUrl(toolName, url)) return
        if (!response.ok()) {
            if (!verifiedResult && !/\/comments(?:\?|$)/.test(url)) {
                if (response.status() === 404) verifiedResult = 'VirusTotal has no existing analysis for the submitted URL.'
                else if (response.status() === 429) verifiedResult = 'VirusTotal rate-limited the lookup. No verdict was returned.'
                else if (response.status() === 403 || response.status() === 429) verifiedResult = providerHttpAccessIssue(toolName, response.status())
            }
            return
        }
        const contentType = response.headers()['content-type'] || ''
        if (!/json|html|text/i.test(contentType)) return
        void response.text()
            .then(body => {
                const result = virusTotalUrlResponse(body, target)
                if (result) verifiedResult = result
                if (/\/comments(?:\?|$)/.test(url) && body) bodies.push(body.slice(0, 80_000))
                if (bodies.length > 8) bodies.shift()
            })
            .catch(() => undefined)
    })
    return {
        text: () => verifiedResult,
        comments: () => uniqueStrings(bodies.flatMap(providerCommunityComments)).slice(0, 8),
    }
}

export function providerHttpAccessIssue(provider: string, status: number) {
    if (status === 404 && /virustotal/i.test(provider)) return 'VirusTotal has no existing report for this URL. No verdict was returned.'
    if (status === 403) return `${provider} denied browser access to this report (HTTP 403). No verdict was returned.`
    if (status === 429) return `${provider} rate-limited the lookup. No verdict was returned.`
    return ''
}


export function parseVirusTotalStats(text: string) {
    const renderedScore = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})\s+(?:Community\s+Score|security\s+vendors?)/i)
    if (renderedScore) {
        const flagged = Number(renderedScore[1]), total = Number(renderedScore[2])
        return total > 0 && flagged <= total ? { flagged, total } : null
    }

    const match = text.match(/"last_analysis_stats"\s*:\s*\{([^}]+)\}/)
    if (!match) return null
    const malicious = numberFromJsonField(match[1], 'malicious')
    const suspicious = numberFromJsonField(match[1], 'suspicious')
    const harmless = numberFromJsonField(match[1], 'harmless')
    const undetected = numberFromJsonField(match[1], 'undetected')
    const timeout = numberFromJsonField(match[1], 'timeout')
    const flagged = malicious + suspicious
    const total = malicious + suspicious + harmless + undetected + timeout
    return total > 0 ? { flagged, total } : null
}

function numberFromJsonField(text: string, field: string) {
    const match = new RegExp(`"${field}"\\s*:\\s*(\\d+)`).exec(text)
    return match ? Number(match[1]) : 0
}

export function parseUrlQueryScores(text: string) {
    const summary = text.match(/\b(\d{1,3})\s+urlquery\s+alerts?\b/i)
    if (summary) return { alerts: Number(summary[1]) }
    // Parse the report's own complete detector summary before related-report rows.
    const report = text.match(/Detections\s+urlquery\s+(\d+)\s+Network Intrusion Detection\s+(\d+)\s+Threat Detection Systems\s+(\d+)/i)
    if (report) return { alerts: Number(report[1]) + Number(report[2]) + Number(report[3]) }
    const signals = new Map<string, number>()
    for (const match of text.matchAll(/\b(URLQuery|IDS|TDS|Threat Detection Systems?)\s*:?\s*(\d+)\s+(?:detections?|signals?)\b/gi)) {
        const label = /^(?:tds|threat detection systems?)$/i.test(match[1]) ? 'tds' : match[1].toLowerCase()
        signals.set(label, Number(match[2]))
    }
    if (signals.has('urlquery') && signals.has('ids') && signals.has('tds')) {
        return { alerts: [...signals.values()].reduce((sum, count) => sum + count, 0) }
    }
    const rows = Array.from(text.matchAll(/\b(\d{1,3})\s*-\s*(\d{1,3})\s*-\s*(\d{1,3})\b/g))
    if (!rows.length) return null
    const alerts = rows.reduce((max, row) => Math.max(max, Number(row[1]) + Number(row[2]) + Number(row[3])), 0)
    return { alerts }
}
