import { aiClientRequest } from '@/utils/ai/client'
import type { AiToolCall } from './aiToolTypes'

export async function runNetworkTool(toolCall: AiToolCall) {
    if (toolCall.action === 'http_request' && toolCall.url) {
        const response = await aiClientRequest('/tools/http/request', {
            method: 'POST',
            body: JSON.stringify({
                url: toolCall.url,
                method: toolCall.method || 'GET',
                headers: toolCall.headers || {},
                body: toolCall.body,
            }),
        })
        const body = await response.text()
        return {
            ok: response.ok,
            message: `HTTP ${toolCall.method || 'GET'} ${toolCall.url}\nStatus: ${response.status}\n\n${body.slice(0, 12000)}`,
        }
    }
    if (toolCall.action !== 'browser_task' || !toolCall.url) return null
    const response = await aiClientRequest('/tools/browser/task', {
        method: 'POST',
        body: JSON.stringify({
            url: toolCall.url,
            timeoutMs: toolCall.timeoutMs,
            captureScreenshot: toolCall.captureScreenshot,
        }),
    })
    const payload = await response.json().catch(() => null) as {
        ok?: boolean
        url?: string
        title?: string
        textExcerpt?: string
        structure?: {
            headings?: string[]
            links?: { text?: string, href?: string }[]
            buttons?: string[]
            inputs?: string[]
            forms?: string[]
            hasViewportMeta?: boolean
        }
        screenshotPath?: string | null
        consoleMessages?: string[]
        pageErrors?: string[]
        error?: string
    } | null
    const consoleMessages = Array.isArray(payload?.consoleMessages) ? payload.consoleMessages : []
    const pageErrors = Array.isArray(payload?.pageErrors) ? payload.pageErrors : []
    const structure = payload?.structure || {}
    const message = [
        `Tool browser_task executed for URL: ${payload?.url || toolCall.url}`,
        `Title: ${payload?.title || '<none>'}`,
        `Screenshot: ${payload?.screenshotPath || '<none>'}`,
        `Viewport meta: ${structure.hasViewportMeta ? 'present' : 'missing/unknown'}`,
        '', 'Headings:', formatStringList(structure.headings), '', 'Links:', formatLinkList(structure.links),
        '', 'Buttons:', formatStringList(structure.buttons), '', 'Inputs/forms:',
        formatStringList([...(structure.inputs || []), ...(structure.forms || [])]), '', 'Page errors:',
        pageErrors.length ? pageErrors.join('\n') : '<none>', '', 'Console:',
        consoleMessages.length ? consoleMessages.join('\n') : '<none>', '', 'Text excerpt:',
        payload?.textExcerpt || payload?.error || '<none>',
    ].join('\n')
    return {
        ok: response.ok && payload?.ok !== false,
        message,
        artifacts: [{
            kind: 'link',
            title: payload?.title || 'Browser target',
            url: payload?.url || toolCall.url,
            content: payload?.textExcerpt || null,
        }] satisfies AIArtifact[],
    }
}

function formatStringList(items: string[] | undefined) {
    const visible = (items || []).map((item) => item.trim()).filter(Boolean).slice(0, 12)
    return visible.length ? visible.map((item) => `- ${item}`).join('\n') : '<none>'
}

function formatLinkList(items: { text?: string, href?: string }[] | undefined) {
    const visible = (items || []).filter((item) => item.text || item.href).slice(0, 12)
        .map((item) => `- ${[item.text, item.href].filter(Boolean).join(' -> ')}`)
    return visible.length ? visible.join('\n') : '<none>'
}
