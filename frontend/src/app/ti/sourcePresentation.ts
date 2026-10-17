import { displayRequirementText, formatLabel, sourceHealthFieldLabel, unique, type SourceHealthRow } from './pageModel'
import type { ActorArtifactHandoffs } from '@/utils/ti/actorWorkbench'
import { humanizeSlug } from '../seo'

export function sourceHealthChipClass(state: SourceHealthRow['state']) {
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'
    return 'max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}
export function compactSourceReferenceLabel(value: string, sourceName?: string, query?: string) {
    const cleaned = displayRequirementText(value).trim()
    const fallback = sourceReferenceSummary(sourceName, query)
    if (!cleaned) return fallback
    if (/^https?:\/\//i.test(value) || /[/?=&]{2,}/.test(value)) return fallback
    if (/[{}[\]]/.test(value) || /\b[a-f0-9]{24,}\b/i.test(value)) return fallback
    if (cleaned.length > 96) return fallback
    return cleaned
}
export function sourceReferenceSummary(sourceName?: string, query?: string) {
    const source = (sourceName || 'This source').trim()
    const actor = humanizeSlug(query || 'this actor')
    if (/malpedia/i.test(source)) return `Malpedia's actor summary for ${actor}.`
    if (/mitre/i.test(source)) return `MITRE ATT&CK's group profile for ${actor}.`
    if (/google cloud security/i.test(source)) return `Google Cloud Security's APT group directory entry for ${actor}.`
    if (/cisa/i.test(source)) return `CISA advisories used to cross-check public government reporting on ${actor}.`
    if (/live reporting query/i.test(source)) return `Live news search used to refresh recent reporting on ${actor}.`
    return `Related reading from ${source} for ${actor} context.`
}
export function sourceHealthEvidenceLabel(row: SourceHealthRow) {
    if (row.captureId) return 'capture reference linked'
    const hasFieldPath = row.provenance.includes('[') || row.provenance.includes(']') || /sourceProvenance|relatedAlerts|handoffs|actorIntelligence/i.test(row.provenance)
    if (hasFieldPath) {
        return `${formatLabel(row.sourceFamily)} evidence request`
    }
    return compactSourceReferenceLabel(row.provenance)
}
export function handoffMissingLabel(values: string[]) {
    return unique(values.map(value => {
        if (/sourceProvenance|capture|source request|source URL|source hash|url/i.test(value)) return sourceHealthFieldLabel(value)
        if (/organization|org|tenant/i.test(value)) return 'organization scope'
        if (/watchlist/i.test(value)) return 'watchlist item'
        if (/alert/i.test(value)) return 'alert review'
        if (/case/i.test(value)) return 'case link'
        if (/webhook|destination/i.test(value)) return 'webhook destination'
        if (/fresh|stale|after/i.test(value)) return 'fresh source evidence'
        return value
    })).join('; ')
}
export function sourceRequestCaptureClass(ready: boolean) {
    return ready
        ? 'max-w-full wrap-break-word rounded-md bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'
        : 'max-w-full wrap-break-word rounded-md bg-ui-raised/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-text dark:bg-ui-raised/10 dark:text-ui-text'
}
export function sourceRequestFamilyLabel(value: string) {
    if (value === 'source_capture') return 'source capture'
    return formatLabel(value)
}
export function recommendedActionLabel(value: string) {
    return displayRequirementText(formatLabel(value))
}
export function artifactReferenceChips(refs: NonNullable<ActorArtifactHandoffs['authBridge']['payload']['evidenceRefs']>) {
    return [
        { label: 'captures', value: refs.captureIds.length },
        { label: 'alerts', value: refs.alertIds.length },
        { label: 'cases', value: refs.casePaths.length },
        { label: 'watch terms', value: refs.watchlistTerms.length },
        { label: 'sources', value: refs.sourceNames.length },
    ].filter(item => item.value > 0)
}
