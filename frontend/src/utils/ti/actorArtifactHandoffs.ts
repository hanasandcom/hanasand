import type { TiActionabilityModel } from './actionability'
import type { TiSearchResponse } from './search'
import { buildAuthenticatedBridge } from './actorAuthenticatedBridge'
import { unique } from './actorArtifactUtils'
import type { ActorArtifact, ActorArtifactHandoffs } from './actorWorkbenchTypes'

export function buildActorArtifactHandoffs(result: TiSearchResponse, artifact: ActorArtifact, actionability: TiActionabilityModel): ActorArtifactHandoffs {
    const artifactContext = {
        recordId: artifact.id,
        kind: artifact.kind,
        label: artifact.label,
        confidence: artifact.confidence,
        freshness: artifact.freshness,
        evidence: artifact.evidence,
        provenance: artifact.provenance,
        readiness: artifact.readiness,
    }
    const watchTerms = artifact.watchlistTerms.length ? artifact.watchlistTerms : actionability.watchlist.payloads.filter(payload => payload.value.toLowerCase() === artifact.label.toLowerCase())
    const readinessMissing = artifact.readiness.blockers
    const enrichmentTasks = unique([...artifact.enrichmentTasks, ...actionability.enrichmentGaps.map(gap => `${gap.title}: ${gap.detail} Dependency: ${gap.dependency}.`)])
    const watchlistMissing = unique([
        ...actionability.exportPayloads.watchlist.missing,
        ...readinessMissing,
        ...(watchTerms.length ? [] : ['Artifact has no customer watchlist term']),
    ])
    const alertMissing = unique([
        ...actionability.exportPayloads.alertRebuild.missing,
        ...readinessMissing,
        ...(watchTerms.length ? [] : ['Artifact has no watchlist term for alert rebuild']),
    ])
    const caseMissing = unique([
        ...actionability.exportPayloads.case.missing,
        ...readinessMissing,
    ])
    const watchlist = {
        ...actionability.exportPayloads.watchlist,
        body: {
            ...actionability.exportPayloads.watchlist.body,
            terms: watchTerms,
            selectedArtifact: artifactContext,
        },
        missing: watchlistMissing,
        blocked: actionability.exportPayloads.watchlist.blocked || watchlistMissing.length > 0,
    }
    const alertRebuild = {
        ...actionability.exportPayloads.alertRebuild,
        body: {
            ...actionability.exportPayloads.alertRebuild.body,
            selectedArtifact: artifactContext,
            watchTerms,
        },
        missing: alertMissing,
        blocked: actionability.exportPayloads.alertRebuild.blocked || alertMissing.length > 0,
    }
    const casePayload = {
        ...actionability.exportPayloads.case,
        body: {
            ...actionability.exportPayloads.case.body,
            selectedArtifact: artifactContext,
        },
        missing: caseMissing,
        blocked: actionability.exportPayloads.case.blocked || caseMissing.length > 0,
    }
    const enrichment = {
        ...actionability.exportPayloads.enrichment,
        body: {
            ...actionability.exportPayloads.enrichment.body,
            selectedArtifact: artifactContext,
            tasks: enrichmentTasks.map((task, index) => ({
                id: `${artifact.id}:task:${index}`,
                title: task.split(':')[0],
                severity: artifact.kind === 'country' && !watchTerms.length ? 'medium' : 'high',
                detail: task,
                dependency: artifact.provenance.length ? 'sourceProvenance capture id or source URL' : 'sourceProvenance[]',
            })),
        },
        missing: enrichmentTasks.length ? [] : ['No enrichment task is attached to the selected record'],
        blocked: enrichmentTasks.length === 0,
    }
    const authBridge = buildAuthenticatedBridge(result, artifact, {
        watchlist,
        alertRebuild,
        case: casePayload,
        enrichment,
    })

    return {
        watchlist,
        alertRebuild,
        case: casePayload,
        enrichment,
        authBridge,
    }
}

export function nextActorArtifactId(artifacts: ActorArtifact[], currentId: string | undefined, direction: 'next' | 'previous' | 'first' | 'last') {
    if (!artifacts.length) return ''
    if (direction === 'first') return artifacts[0]?.id ?? ''
    if (direction === 'last') return artifacts[artifacts.length - 1]?.id ?? ''
    const currentIndex = Math.max(0, artifacts.findIndex(item => item.id === currentId))
    const delta = direction === 'next' ? 1 : -1
    const nextIndex = (currentIndex + delta + artifacts.length) % artifacts.length
    return artifacts[nextIndex]?.id ?? ''
}
