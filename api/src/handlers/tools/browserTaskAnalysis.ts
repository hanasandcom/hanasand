import { extractPageContent, emptyStructure } from './browserTaskContent.ts'
import { emptyQuality, inspectPageQuality } from './browserTaskQuality.ts'

export function analyzeBrowserPage(html: string, pageUrl: string) {
    const { title, textExcerpt, structure, controls } = extractPageContent(html)
    const quality = inspectPageQuality(html, structure, pageUrl, title, controls)

    return { title, textExcerpt, structure, quality }
}

export function extractBrowserPageContent(html: string) {
    const { title, textExcerpt, structure } = extractPageContent(html)
    return { title, textExcerpt, structure }
}

export function emptyBrowserPageAnalysis() {
    return { title: null, textExcerpt: '', structure: emptyStructure(), quality: emptyQuality() }
}
