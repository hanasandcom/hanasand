import type { Capture } from '../types'
import { buildAnalystSummary } from '../browserAnalystSummary'

export function metadataRows(summary: ReturnType<typeof buildAnalystSummary>, captures: Capture[]) {
    const pageCaptures = captures.filter(capture => capture.kind === 'page')
    const toolCaptures = captures.filter(capture => capture.kind === 'tool')
    return summary.rows.flatMap(row => {
        if (/^(unknown|none extracted)$/i.test(row.value)) return []
        const lower = row.label.toLowerCase()
        const numericValue = Number(row.value.replace(/[^\d.-]/g, ''))
        const isZeroValue = Number.isFinite(numericValue) && numericValue === 0
        const isNoValue = /^(no|false)$/i.test(row.value)
        if ((isZeroValue || isNoValue) && !lower.includes('blocked') && !lower.includes('profile tools')) return []
        const related = lower.includes('screenshots') || lower.includes('network') || lower.includes('domain') || lower.includes('failed') || lower.includes('url states')
            ? pageCaptures
            : lower.includes('virustotal')
                ? toolCaptures.filter(capture => capture.toolAnalysis?.toolKind === 'virustotal')
                : lower.includes('urlquery')
                    ? toolCaptures.filter(capture => capture.toolAnalysis?.toolKind === 'urlquery')
                    : lower.includes('webcrack') || lower.includes('obfuscated')
                        ? captures.filter(capture => capture.webcrackLoad || capture.evidence?.deobfuscationTasks?.length || capture.evidence?.obfuscatedScripts?.length)
                        : lower.includes('profile tools')
                            ? toolCaptures
                            : captures
        if (!related.length && row.value === '0') return []
        return [{
            ...row,
            captures: related,
            details: metadataDetails(row.label, row.value, related),
        }]
    })
}

export function metadataDetails(label: string, value: string, captures: Capture[]) {
    const lines = [
        `${label}: ${value}`,
        ...captures.flatMap(capture => [
            capture.toolAnalysis?.extractedSignals?.join(' · ') || '',
            meaningfulReasons(capture.evidence?.reasons).join(' · '),
        ]),
    ].map(line => line.trim()).filter(Boolean)
    return Array.from(new Set(lines)).slice(0, 6)
}

export function meaningfulReasons(reasons?: string[]) {
    return (reasons || []).filter(reason => !/^No high-signal malicious pattern was extracted/i.test(reason))
}
