export const MAX_STRUCTURE_ITEMS = 20

const MAX_EXCERPT_LENGTH = 5000

export function extractPageContent(html: string) {
    const controls = extractControls(html)
    return {
        title: extractTitle(html),
        textExcerpt: extractTextExcerpt(html),
        structure: extractStructure(html, controls),
        controls,
    }
}

export function emptyStructure() {
    return {
        headings: [],
        links: [],
        buttons: [],
        inputs: [],
        forms: [],
        hasViewportMeta: false,
    }
}

function extractTitle(html: string) {
    return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim() || null
}

function extractTextExcerpt(html: string) {
    const withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    const text = decodeHtml(withoutScripts.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
    return text.slice(0, MAX_EXCERPT_LENGTH)
}

function extractStructure(html: string, controls = extractControls(html)) {
    return {
        headings: extractTaggedText(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi),
        links: extractLinks(html),
        buttons: extractTaggedText(html, /<button[^>]*>([\s\S]*?)<\/button>/gi),
        inputs: extractInputs(controls),
        forms: extractFormSummaries(html),
        hasViewportMeta: /<meta\s+[^>]*name=["']viewport["'][^>]*>/i.test(html),
    }
}

function extractTaggedText(html: string, pattern: RegExp) {
    return [...html.matchAll(pattern)]
        .map((match) => stripTags(match[1] || ''))
        .filter(Boolean)
        .slice(0, MAX_STRUCTURE_ITEMS)
}

function extractLinks(html: string) {
    return [...html.matchAll(/<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi)]
        .map((match) => ({
            text: stripTags(match[2] || ''),
            href: extractAttribute(match[1] || '', 'href'),
        }))
        .filter((link) => link.text || link.href)
        .slice(0, MAX_STRUCTURE_ITEMS)
}

function extractInputs(controls: ReturnType<typeof extractControls>) {
    return controls
        .map((control) => {
            return [
                extractAttribute(control.attrs, 'aria-label'),
                extractAttribute(control.attrs, 'placeholder'),
                extractAttribute(control.attrs, 'name'),
                extractAttribute(control.attrs, 'id'),
                extractAttribute(control.attrs, 'type'),
            ].filter(Boolean).join(' / ')
        })
        .filter(Boolean)
        .slice(0, MAX_STRUCTURE_ITEMS)
}

export function extractControls(html: string) {
    return [...html.matchAll(/<(input|textarea|select)\s+([^>]*?)(?:\/?>|>[\s\S]*?<\/\1>)/gi)]
        .map((match) => ({ tag: match[1] || '', attrs: match[2] || '' }))
}

function extractFormSummaries(html: string) {
    return [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)]
        .map((match) => {
            const body = match[1] || ''
            const inputs = extractInputs(extractControls(body)).slice(0, 8)
            const buttons = extractTaggedText(body, /<button[^>]*>([\s\S]*?)<\/button>/gi).slice(0, 4)
            return [...inputs, ...buttons].join(' | ')
        })
        .filter(Boolean)
        .slice(0, 8)
}

export function extractAttribute(attributes: string, name: string) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = attributes.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'))
    return decodeHtml(match?.[1] || '').trim()
}

export function stripTags(value: string) {
    return decodeHtml(value.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
}

function decodeHtml(value: string) {
    return value
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
}
