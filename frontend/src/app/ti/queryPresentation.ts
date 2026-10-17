import { displayRequirementText } from './pageModel'
import { formatIsoDate } from '@/utils/date/formatIsoDate'
import type { TiSearchResponse } from '@/utils/ti/search'
import { countryFromValue } from '@/utils/ti/actorProfile'
import type { actorGeoProfile } from '@/utils/ti/actorProfile'
import type { TiActionabilityModel } from '@/utils/ti/actionability'

export function classifyPublicTiQuery(query: string): NonNullable<TiSearchResponse['queryKind']> {
    const clean = query.trim()
    if (/^cve-\d{4}-\d{4,}$/i.test(clean)) return 'cve'
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(clean)) return 'domain'
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(clean) || /^(?:https?:\/\/|[a-f0-9]{32,128}$)/i.test(clean)) return 'indicator'
    if (/^(?:apt\d+|lockbit|akira|cozy bear|midnight blizzard)$/i.test(clean)) return 'actor'
    return clean.includes(' ') ? 'organization' : 'free_text'
}
export const formatDate = (value: string) => formatIsoDate(value, 'Date unavailable')
export function techniqueDescription(attackId: string, name: string, tactic: string, detail: string) {
    const descriptions: Record<string, string> = {
        'T1005': 'Data from Local System: collecting files or data from a compromised computer before staging, exfiltration, or further use.',
        'T1078': 'Valid Accounts: using legitimate user, service, or cloud accounts to access systems and avoid obvious intrusion paths.',
        'T1078.004': 'Valid Accounts: Cloud Accounts: using legitimate cloud account credentials to access cloud-hosted services and resources.',
        'T1102': 'Web Service: using an external web service as part of command-and-control or operational infrastructure.',
        'T1105': 'Ingress Tool Transfer: moving tools, malware, scripts, or payloads into a compromised environment.',
        'T1110': 'Brute Force: trying passwords, password hashes, or credential material to gain access to accounts.',
        'T1110.003': 'Password Spraying: trying a small number of common passwords across many accounts to avoid lockouts.',
        'T1114': 'Email Collection: collecting email messages or mail data from local systems, remote services, or cloud mailboxes.',
        'T1486': 'Data Encrypted for Impact: encrypting data on target systems to disrupt operations or support extortion.',
        'T1566': 'Phishing: sending deceptive messages to trick users into opening links, attachments, or giving up access.',
        'T1566.001': 'Spearphishing Attachment: sending targeted emails with malicious attachments to gain execution or access.',
        'T1567': 'Exfiltration Over Web Service: sending stolen data to a web service controlled by, or usable by, the actor.',
    }
    return displayRequirementText(descriptions[attackId] ?? `${name}: ${detail || `Reported under the ${tactic} tactic.`}`)
}
export function countryCodeForMapFeature(name: string | undefined) {
    if (!name) return null
    const normalized = name.trim().toLowerCase()
    const mapped = mapFeatureNameToCode[normalized]
    if (mapped) return mapped
    const country = countryFromValue(normalized)
    return country?.code ?? null
}
export const mapFeatureNameToCode: Record<string, string> = {
    england: 'GB',
    russia: 'RU',
    usa: 'US',
}
export function geographyContextPayloadFor(point: ReturnType<typeof actorGeoProfile>['points'][number], handoff?: TiActionabilityModel['geographyHandoffs'][number]) {
    return {
        schemaVersion: 'ti.public_actor.geography_context.v1',
        country: {
            code: point.code,
            name: point.label,
            role: point.role,
            observationCount: point.count,
            basis: 'country_source_coverage',
        },
        action: handoff?.watchlistTerm ? 'review_watchlist_term' : 'queue_source_enrichment',
        watchlistTerm: handoff?.watchlistTerm ?? null,
        enrichmentTask: handoff?.enrichmentTask ?? `Attach source evidence before reviewing ${point.label} in monitoring.`,
        provenanceSummary: handoff?.provenanceSummary ?? point.detail,
        evidence: handoff?.evidenceRows.map(row => ({
            victim: row.victim,
            source: row.source,
            sourceIds: row.sourceIds,
            provenanceRefs: row.provenanceRefs,
            reportDate: row.reportDate,
            confidence: row.confidence,
        })) ?? [],
        route: handoff?.watchlistTerm ? '/watchlists' : '/ti/profiles',
        blockedBy: handoff ? [] : [{
            ownerLane: 'source',
            reason: 'Country row needs source evidence before it can be routed.',
        }],
    }
}
