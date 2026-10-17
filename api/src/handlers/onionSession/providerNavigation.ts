import type { Page } from 'playwright'
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
    if (kind === 'urlquery') return `https://urlquery.net/search?q=${encodeURIComponent(target)}`
    return resolvedUrl
}

export function virusTotalUrlId(target: string) {
    try {
        return Buffer.from(new URL(target).href).toString('base64url')
    } catch {
        return Buffer.from(target).toString('base64url')
    }
}

export async function interactWithProvider(page: Page, tool: { id?: string; name?: string; url?: string }, target: string) {
    try {
        const kind = officialProviderKind(page.url())
        if (kind === 'virustotal' && /\/gui\/url\//i.test(page.url())) return ''
        if (kind === 'urlquery' && /\/search\?q=/i.test(page.url())) return ''
        if (kind === 'virustotal' && isVirusTotalTool(tool, page.url())) {
            await page.waitForTimeout(900)
            const searchInput = page.locator('input[type="text"], textarea:not([name="g-recaptcha-response"])').first()
            await searchInput.fill(target, { timeout: 2500 }).catch(async () => {
                await page.keyboard.type(target)
            })
            await page.keyboard.press('Enter')
            return ''
        }
        if (kind === 'urlquery' && isUrlQueryTool(tool, page.url())) {
            await page.locator('input[name="q"]').fill(target, { timeout: 3000 })
            await page.keyboard.press('Enter')
            return ''
        }
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
    return ''
}

