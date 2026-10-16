import type {
    TiActivityEvent,
    TiEnrichedActor,
    TiEnrichmentOverview,
    TiManagementAuditEvent,
    TiProfileUpdate,
    TiWorkerState,
} from './enrichmentTypes'

type PersistedEnrichmentStatus = {
    worker: {
        state: TiWorkerState
        lastRunAt: string | null
        lastSuccessfulRunAt: string | null
        currentFailure: string | null
        snapshotFresh: boolean
    }
    queued?: number
    productivity?: { profiles: number, wordsAdded: number, newFacts: number }
    latestRun: {
        id: string
        status: string
        actorCount: number
        sourceCount: number
        changedFieldCount: number
        evidenceCount: number
        failureCount: number
        finishedAt: string | null
    } | null
}

type PersistedActorProfile = {
    id: string
    canonicalName: string
    aliases: string[]
    confidence: number
    firstSeenAt: string
    lastSeenAt: string
    updatedAt: string
    sourceIds: string[]
    captureIds: string[]
    evidenceCount: number
    actorType: string
}

export function enrichmentOverviewFromSnapshot(
    profiles: PersistedActorProfile[],
    updates: TiProfileUpdate[],
    status: PersistedEnrichmentStatus | null | undefined,
    dataAvailable: boolean,
): TiEnrichmentOverview {
    const actors = new Map<string, TiEnrichedActor>()
    for (const profile of profiles) {
        const links = profile.sourceIds.map(sourceId => ({ name: sourceId, url: '' }))
        actors.set(profile.id, {
            id: profile.id,
            name: profile.canonicalName,
            aliases: profile.aliases,
            status: 'ready',
            confidence: profile.confidence,
            lastUpdatedAt: profile.updatedAt || profile.lastSeenAt,
            nextRefreshAt: profile.lastSeenAt,
            changedFields: [],
            sourceLinks: uniqueSources(links),
            automationEvidence: profile.captureIds,
            plannedWork: [],
            refreshCount: profile.evidenceCount,
        })
    }

    const activity: TiActivityEvent[] = updates.map(update => {
        const actor = actors.get(update.actorId)
        const source = update.sourceName || update.sourceId || 'retained evidence'
        return {
            id: update.id,
            actorId: update.actorId,
            actorName: update.actorName || actor?.name || update.actorId,
            happenedAt: update.observedAt,
            title: update.summary,
            detail: update.changedFields.join(' · ') || 'Profile evidence updated.',
            source,
            tone: 'ok',
        }
    })
    const updatedLastHour = activity.filter(event => Date.now() - Date.parse(event.happenedAt) <= 3_600_000).length

    return {
        generatedAt: new Date().toISOString(),
        dataAvailable,
        worker: {
            state: dataAvailable ? status?.worker.state ?? 'unavailable' : 'unavailable',
            mode: 'automated monitoring',
            intervalSeconds: 300,
            batchSize: profiles.length,
            lastSweepStartedAt: status?.latestRun?.finishedAt || null,
            lastSweepFinishedAt: status?.worker.lastSuccessfulRunAt || null,
            lastError: status?.worker.currentFailure || null,
            cursor: 0,
            lastRunId: status?.latestRun?.id || null,
            lastRunAt: status?.worker.lastRunAt || null,
            lastSuccessfulRunAt: status?.worker.lastSuccessfulRunAt || null,
            snapshotFresh: status?.worker.snapshotFresh ?? false,
        },
        updatedActors: [...actors.values()],
        queuedActors: [],
        activity,
        updates,
        auditLog: [] as TiManagementAuditEvent[],
        stats: {
            updatedLastHour: status?.productivity?.profiles ?? updatedLastHour,
            queued: status?.queued ?? 0,
            auditedEvents: 0,
            automaticCoverage: profiles.length,
            totalRefreshes: activity.length,
            profilesProcessed: status?.latestRun?.actorCount ?? 0,
            wordsAdded: status?.productivity?.wordsAdded ?? 0,
            newFacts: status?.productivity?.newFacts ?? 0,
            profilesChanged: status?.latestRun?.changedFieldCount ?? 0,
            sourceRecords: status?.latestRun?.sourceCount ?? 0,
            evidenceRecords: status?.latestRun?.evidenceCount ?? 0,
            failures: status?.latestRun?.failureCount ?? 0,
        },
    }
}

export function parsePersistedProfile(value: unknown): PersistedActorProfile | undefined {
    if (!isRecord(value)) return undefined
    const id = stringValue(value.id)
    const canonicalName = stringValue(value.canonicalName, value.name)
    if (!id || !canonicalName) return undefined
    return {
        id,
        canonicalName,
        aliases: listValue(value.aliases).map(stringValue).filter(Boolean),
        confidence: numberValue(value.confidence),
        firstSeenAt: stringValue(value.firstSeenAt),
        lastSeenAt: stringValue(value.lastSeenAt, value.updatedAt),
        updatedAt: stringValue(value.updatedAt, value.lastSeenAt),
        sourceIds: listValue(value.sourceIds).map(stringValue).filter(Boolean),
        captureIds: listValue(value.captureIds).map(stringValue).filter(Boolean),
        evidenceCount: numberValue(value.evidenceCount),
        actorType: stringValue(value.actorType, 'actor'),
    }
}

export function parseProfileUpdate(value: unknown): TiProfileUpdate | undefined {
    if (!isRecord(value)) return undefined
    const id = stringValue(value.id)
    const actorId = stringValue(value.subjectId)
    const observedAt = stringValue(value.observedAt)
    if (!id || !actorId || !observedAt || value.subjectType !== 'actor_profile') return undefined
    const metadata = isRecord(value.metadata) ? value.metadata : {}
    const aliases = listValue(metadata.aliasesAdded).map(stringValue).filter(Boolean)
    const fields = Object.keys(isRecord(metadata.characterization) ? metadata.characterization : {})
    const changedFields = [...new Set([...aliases.map(alias => `alias: ${alias}`), ...fields])]
    return {
        id,
        actorId,
        actorName: stringValue(value.actorName),
        sourceName: stringValue(value.sourceName),
        observedAt,
        sourceId: stringValue(value.sourceId),
        captureIds: listValue(value.captureIds).map(stringValue).filter(Boolean),
        kind: stringValue(value.kind, 'updated'),
        changedFields,
        summary: changedFields.length ? changedFields.join(' · ') : 'New retained evidence linked to this profile.',
    }
}

function uniqueSources(sources: Array<{ name: string, url: string }>) {
    return [...new Map(sources.map(source => [`${source.name}:${source.url}`, source])).values()]
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object'
}

function stringValue(...values: unknown[]) {
    return values.map(value => typeof value === 'string' ? value.trim() : '').find(Boolean) || ''
}

function listValue(value: unknown) {
    return Array.isArray(value) ? value : []
}

function numberValue(...values: unknown[]) {
    for (const value of values) {
        const number = Number(value)
        if (Number.isFinite(number) && number >= 0) return number
    }
    return 0
}
