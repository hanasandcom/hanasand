import type { TiActionabilityModel } from './actionability'
import { countryFromValue, type VictimObservation } from './actorProfile'
import type { TiActorIntelligenceProfile } from './actorIntelligence'
import type { TiSearchResponse } from './search'
import { matchingActivity, matchingTechnique, observedFreshnessFor, recordFromActorList, recordId, recordSourceDetails, unique, uniqueBy, withReadiness } from './actorArtifactUtils'
import type { ActorArtifact } from './actorWorkbenchTypes'

export function buildActorArtifacts(
    result: TiSearchResponse,
    actor: TiActorIntelligenceProfile,
    victimObservations: VictimObservation[],
    actionability: TiActionabilityModel
): ActorArtifact[] {
    const provenance = recordSourceDetails(actor, actionability)
    const countryArtifacts = actionability.geographyHandoffs.map(item => {
        const victims = victimObservations.filter(observation => countryFromValue(observation.country)?.code === item.code)
        return withReadiness({
            result,
            artifact: {
                id: recordId('country', item.code),
                kind: 'country' as const,
                label: item.country,
                subtitle: item.role === 'operator' ? 'Attribution context' : `${item.observationCount} victim or targeting observation${item.observationCount === 1 ? '' : 's'}`,
                confidence: actor.confidence,
                freshness: observedFreshnessFor(result, actor),
                evidence: unique([
                    item.provenanceSummary,
                    ...victims.map(victim => `${victim.victim}: ${victim.sector}; ${victim.timeframe}; ${victim.incident}`),
                    ...item.evidenceRows.map(row => `${row.victim}: ${row.reportDate}; ${Math.round(row.confidence * 100)}% confidence; ${row.source}`),
                ]),
                provenance: unique([
                    item.provenanceSummary,
                    ...item.evidenceRows.flatMap(row => [
                        row.source,
                        ...row.sourceIds.map(sourceId => `source ${sourceId}`),
                        ...row.provenanceRefs,
                    ]),
                    ...victims.map(victim => victim.source),
                    ...provenance,
                ]).slice(0, 8),
                watchlistTerms: item.watchlistTerm ? [{
                    kind: item.watchlistTerm.kind,
                    value: item.watchlistTerm.value,
                    notes: `${result.query}: ${item.watchlistTerm.reason}`,
                }] : [],
                enrichmentTasks: [item.enrichmentTask],
            },
        })
    })

    const toolArtifacts = actor.malwareTools.map(tool => recordFromActorList({
        result,
        actor,
        actionability,
        kind: 'tool',
        label: tool,
        subtitle: 'Malware, tooling, or capability tied to this actor profile',
        evidence: [
            `${tool} is carried in the actor intelligence profile.`,
            ...matchingActivity(result, tool),
            ...matchingTechnique(result, tool),
        ],
        watchlistKind: 'vendor',
        enrichmentTask: `Attach source-level evidence for ${tool}, including first/last seen, tool family, and related campaign before using it in alert enrichment.`,
    }))

    const campaignArtifacts = actor.campaigns.map(campaign => recordFromActorList({
        result,
        actor,
        actionability,
        kind: 'campaign',
        label: campaign,
        subtitle: 'Campaign or operation context tied to actor intelligence',
        evidence: [
            `${campaign} is carried in the actor intelligence profile.`,
            ...matchingActivity(result, campaign),
        ],
        watchlistKind: 'vendor',
        enrichmentTask: `Attach campaign source details for ${campaign}, including named victims, timeframe, and capture or advisory reference.`,
    }))

    const infrastructureArtifacts = actor.infrastructure.map(item => recordFromActorList({
        result,
        actor,
        actionability,
        kind: 'infrastructure',
        label: item,
        subtitle: 'Infrastructure pattern for source collection and alert enrichment',
        evidence: [
            `${item} is carried in the actor intelligence profile.`,
            ...matchingActivity(result, item),
        ],
        watchlistKind: 'domain',
        enrichmentTask: `Collect concrete observable or source details for ${item} before promoting it into customer alert matching.`,
    }))

    const techniqueArtifacts = result.ttps.map(ttp => withReadiness({
        result,
        artifact: {
            id: recordId('technique', ttp.attackId || ttp.name),
            kind: 'technique' as const,
            label: ttp.attackId ? `${ttp.attackId} ${ttp.name}` : ttp.name,
            subtitle: ttp.tactic,
            confidence: ttp.confidence,
            freshness: observedFreshnessFor(result, actor),
            evidence: unique([ttp.tactic, ttp.detail, ...matchingActivity(result, ttp.name)]),
            provenance: unique([ttp.attackId ? 'MITRE ATT&CK mapped profile field' : 'Profile tradecraft field', ...provenance]).slice(0, 6),
            watchlistTerms: [],
            enrichmentTasks: [`Map ${ttp.attackId || ttp.name} to detection or hunting logic before routing it as customer-facing alert context.`],
        },
    }))

    return uniqueBy([
        ...countryArtifacts,
        ...toolArtifacts,
        ...campaignArtifacts,
        ...infrastructureArtifacts,
        ...techniqueArtifacts,
    ], item => item.id).slice(0, 40)
}
