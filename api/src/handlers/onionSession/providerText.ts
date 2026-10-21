import type { Page } from 'playwright'
import { withTimeout } from './asyncOperations.ts'
import { domainFromUrl } from './networkTelemetry.ts'
import { firstUrlQueryReportUrl, urlQueryReportMatchesTarget, parseUrlQueryScores, parseVirusTotalStats } from './providerUrlResponses.ts'
import { isVirusTotalTool, isUrlQueryTool, virusTotalUrlId } from './providerNavigation.ts'
import type { collectPageEvidence } from './pageEvidence.ts'

export function providerResponseUrl(toolName: string, url: string) {
    return /virustotal/i.test(toolName)
        && /^https:\/\/www\.virustotal\.com\/(?:ui\/urls|api\/v3\/urls)\/[^/?]+(?:\/comments)?(?:\?|$)/i.test(url)
}

export function enrichProviderEvidence<T extends Awaited<ReturnType<typeof collectPageEvidence>>>(evidence: T, providerText: string, providerHint = '', communityComments: string[] = []): T {
    if (!providerText && !communityComments.length) return evidence
    const summary = providerSummaryText(providerText, providerHint)
    const cleanProviderText = cleanAnalystText(providerText, 1800)
    return {
        ...evidence,
        textExcerpt: [evidence.textExcerpt, summary, cleanProviderText].filter(Boolean).join('\n'),
        communityComments: uniqueStrings([...(evidence.communityComments || []), ...communityComments]).slice(0, 8),
    }
}

export function providerCommunityComments(body: string) {
    let root: unknown
    try {
        root = JSON.parse(body)
    } catch {
        return []
    }
    const comments: string[] = []
    const add = (value: unknown) => {
        if (typeof value !== 'string') return
        const clean = cleanAnalystText(value, 500)
        if (clean) comments.push(clean)
    }
    const visit = (value: unknown) => {
        if (!value || typeof value !== 'object') return
        if (Array.isArray(value)) {
            value.forEach(visit)
            return
        }
        const record = value as Record<string, unknown>
        const attributes = record.attributes && typeof record.attributes === 'object' ? record.attributes as Record<string, unknown> : undefined
        if (record.type === 'comment') add(attributes?.text || attributes?.html)
        if (Array.isArray(record.comments)) {
            for (const item of record.comments) {
                if (item && typeof item === 'object') {
                    const comment = item as Record<string, unknown>
                    add(comment.comment || comment.text)
                }
            }
        }
        Object.values(record).forEach(visit)
    }
    visit(root)
    return uniqueStrings(comments).slice(0, 8)
}

export async function fetchProviderCommunityComments(page: Page, tool: { id?: string; name?: string; url?: string }, target: string) {
    if (!isVirusTotalTool(tool, page.url()) || !domainFromUrl(page.url()).endsWith('virustotal.com')) return []
    const body = await withTimeout(page.evaluate(async (urlId) => {
        const response = await fetch(`/ui/urls/${urlId}/comments?limit=8`, { credentials: 'include' })
        return response.ok ? response.text() : ''
    }, virusTotalUrlId(target)), 3000, '')
    return providerCommunityComments(body)
}

export function providerSummaryText(providerText: string, providerHint = '') {
    const lowerHint = providerHint.toLowerCase()
    const vt = parseVirusTotalStats(providerText)
    const uq = parseUrlQueryScores(providerText)
    return [
        !lowerHint.includes('urlquery') && vt ? Number.isFinite(vt.total) ? `${vt.flagged}/${vt.total} security vendors flagged this URL.` : `${vt.flagged} security vendors flagged this URL.` : '',
        !lowerHint.includes('virustotal') && uq ? `${uq.alerts} urlquery alerts were found.` : '',
    ].filter(Boolean).join('\n')
}

export function cleanAnalystText(value: string, maxLength = 900) {
    return value
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
}

export function uniqueStrings(values: string[]) {
    return [...new Set(values.filter(Boolean))]
}

export async function waitForProviderData(tool: { id?: string; name?: string; url?: string }, page: Page, providerText: () => string, target: string) {
    const deadline = Date.now() + providerDataTimeoutMs(tool)
    let reportOpened = /\/report\//i.test(page.url())
    while (Date.now() < deadline) {
        if (providerText()) return providerText()
        const text = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '')
        const accessIssue = providerAccessIssue(tool, text, page.url())
        if (accessIssue) return accessIssue
        if (isUrlQueryTool(tool)) {
            if (/no reports matched this query/i.test(text)) return 'No matching urlquery report was available for the submitted URL. No clean verdict was inferred.'
            if (!reportOpened) {
                const reportUrl = await firstUrlQueryReportUrl(page, target)
                if (reportUrl) {
                    await page.goto(reportUrl, { waitUntil: 'domcontentloaded', timeout: providerTimeoutMs(tool) })
                    reportOpened = true
                    continue
                }
            } else if (urlQueryReportMatchesTarget(text, target)) {
                const score = parseUrlQueryScores(text)
                if (score) {
                    const visited = text.match(/\bVisited\s+(?:public\s+)?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/i)?.[1]
                    return `${score.alerts} urlquery alerts were found.\nExisting urlquery report${visited ? `: ${visited}` : ''}.`
                }
            }
        }
        await new Promise(resolve => setTimeout(resolve, 250))
    }
    return isUrlQueryTool(tool) && !reportOpened
        ? 'No matching urlquery report was available for the submitted URL. No clean verdict was inferred.'
        : 'No verified report returned for the submitted URL within the provider time limit.'
}

export function providerTimeoutMs(tool: { id?: string; name?: string; url?: string }) {
    return isVirusTotalTool(tool) ? 15_000 : isUrlQueryTool(tool) ? 10_000 : 4_000
}

function providerDataTimeoutMs(tool: { id?: string; name?: string; url?: string }) {
    return isVirusTotalTool(tool) ? 45_000 : isUrlQueryTool(tool) ? 18_000 : 5_000
}

export function providerScreenshotTimeoutMs(tool: { id?: string; name?: string; url?: string }, fallback: number) {
    return isUrlQueryTool(tool) ? 4_000 : isVirusTotalTool(tool) ? Math.max(fallback, 3_000) : fallback
}

export async function waitForProviderVisual(tool: { id?: string; name?: string; url?: string }, page: Page) {
    if (isVirusTotalTool(tool)) await page.waitForTimeout(8_000).catch(() => undefined)
    else if (isUrlQueryTool(tool)) await page.waitForTimeout(2_000).catch(() => undefined)
}

export function hasParsedProviderData(tool: { id?: string; name?: string; url?: string }, text: string) {
    if (isVirusTotalTool(tool) && parseVirusTotalStats(text)) return true
    if (isUrlQueryTool(tool) && parseUrlQueryScores(text)) return true
    return false
}

export function providerAccessIssue(tool: { id?: string; name?: string; url?: string }, text: string, currentUrl = '') {
    if (/recaptcharequired|recaptcha validation failed|captcha/i.test(text)) return 'Provider blocked automated capture with a reCAPTCHA challenge.'
    // A provider report can quote the target page's own 403 response (for
    // example, URLQuery may title the captured page "403: FORBIDDEN"). Only
    // recognize an explicit provider-side permission error here. HTTP status
    // codes for provider navigation/API requests are handled from responses.
    if (/does not have permission to get url|denied browser access/i.test(text)) {
        if (isVirusTotalTool(tool, currentUrl) || isUrlQueryTool(tool, currentUrl)) {
            const provider = isVirusTotalTool(tool, currentUrl) ? 'VirusTotal' : 'urlquery'
            return `${provider} denied browser access to this report (HTTP 403). No verdict was returned.`
        }
    }
    if (isVirusTotalTool(tool, currentUrl) && /\bitem not found\b|no existing (?:url )?analysis/i.test(text)) return 'VirusTotal has no existing report for this URL. No verdict was returned.'
    if (isVirusTotalTool(tool, currentUrl) && /\/gui\/home\/(?:upload|search)/i.test(currentUrl)) return 'VirusTotal did not open a URL report; provider redirected to its upload/search home.'
    return ''
}
