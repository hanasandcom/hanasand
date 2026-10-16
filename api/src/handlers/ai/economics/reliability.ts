import { numberValue } from './numberValue.ts'
import type { BuildDeployRow, FailedProofRow, QueueDepthRow, TimingRow, VerificationLatencyRow } from './reliabilityTypes.ts'

export function buildReliability({ clients, estimatedCostNok, queueRows, latencyRows, buildDeployRows, failedProofRows, firstOutput, deployTiming }: {
    clients: GPT_Client[]
    estimatedCostNok: number
    queueRows: QueueDepthRow[]
    latencyRows: VerificationLatencyRow[]
    buildDeployRows: BuildDeployRow[]
    failedProofRows: FailedProofRow[]
    firstOutput?: TimingRow
    deployTiming?: TimingRow
}) {
    const queueDepth = queueRows.map((row) => ({
        lane: row.lane || 'standard',
        model: row.kind || 'verification',
        kind: row.kind,
        status: row.status,
        count: numberValue(row.count),
    }))
    const totalQueued = queueDepth
        .filter((row) => row.status === 'queued')
        .reduce((sum, row) => sum + row.count, 0)
    const verificationLatency = latencyRows.map((row) => ({
        kind: row.kind,
        p50Ms: numberValue(row.p50_ms),
        p95Ms: numberValue(row.p95_ms),
        sampleCount: numberValue(row.sample_count),
    }))
    const buildDeploy = buildDeployRows.map((row) => {
        const total = numberValue(row.total)
        const completed = numberValue(row.completed)
        return {
            kind: row.kind,
            completed,
            failed: numberValue(row.failed),
            cancelled: numberValue(row.cancelled),
            total,
            successRate: total > 0 ? completed / total : 0,
        }
    })
    const failedProofCategories = failedProofRows.map((row) => ({
        category: row.category,
        kind: row.kind,
        count: numberValue(row.count),
    }))
    const gpuLanes = liveGpuLanes(clients)
    const totalAvailableSessions = gpuLanes.reduce((sum, lane) => sum + lane.availableSessions, 0)
    const totalActiveSessions = gpuLanes.reduce((sum, lane) => sum + lane.activeSessions, 0)
    const successfulVerifiedBuilds = buildDeploy
        .filter((row) => row.kind === 'build' || row.kind === 'deploy')
        .reduce((sum, row) => sum + row.completed, 0)
    const lowestSuccessRate = buildDeploy.length ? Math.min(...buildDeploy.map((row) => row.successRate || 0)) : 1
    const incidentStatus = incidentFrom({
        gpuLaneCount: gpuLanes.length,
        totalQueued,
        totalAvailableSessions,
        lowestSuccessRate,
        failedProofCount: failedProofCategories.reduce((sum, row) => sum + row.count, 0),
    })

    return {
        incidentStatus,
        queueDepth,
        verificationLatency,
        buildDeploy,
        failedProofCategories,
        gpuLanes,
        costPerSuccessfulVerifiedBuildNok: successfulVerifiedBuilds > 0 ? estimatedCostNok / successfulVerifiedBuilds : 0,
        promptTiming: {
            p50FirstUsefulOutputMs: numberValue(firstOutput?.p50_ms),
            p95FirstUsefulOutputMs: numberValue(firstOutput?.p95_ms),
            sampleCount: numberValue(firstOutput?.sample_count),
        },
        deployTiming: {
            p50PromptToVerifiedDeployMs: numberValue(deployTiming?.p50_ms),
            p95PromptToVerifiedDeployMs: numberValue(deployTiming?.p95_ms),
            sampleCount: numberValue(deployTiming?.sample_count),
        },
        capacity: {
            totalQueued,
            totalActiveSessions,
            totalAvailableSessions,
        },
    }
}

function liveGpuLanes(clients: GPT_Client[]) {
    return clients.flatMap((client) => {
        const model = client.modelId || client.model?.conversationId || client.name
        const clientPowerWatts = numberValue(client.power?.totalWatts)
        const lanes = client.lanes?.length ? client.lanes : []
        return lanes.map((lane) => ({
            clientName: client.displayName || client.name,
            lane: lane.label || lane.id || `GPU ${lane.gpuIndex + 1}`,
            model: lane.model || model,
            status: client.model?.status || 'unknown',
            tier: lane.tier || 'fast',
            activeSessions: numberValue(lane.activeRequests),
            queuedSessions: numberValue(lane.queuedRequests),
            maxSessions: numberValue(lane.maxRequests),
            availableSessions: numberValue(lane.availableRequests),
            contextMaxTokens: numberValue(lane.contextMaxTokens),
            memoryUsedMb: numberValue(lane.memoryUsedMb),
            memoryTotalMb: numberValue(lane.memoryTotalMb),
            gpuLoad: numberValue(lane.gpuLoad),
            powerWatts: numberValue(lane.powerDrawWatts) || clientPowerWatts / Math.max(1, lanes.length),
            powerLimitWatts: numberValue(lane.powerLimitWatts),
            temperatureC: numberValue(lane.temperatureC),
        }))
    })
}

function incidentFrom({ gpuLaneCount, totalQueued, totalAvailableSessions, lowestSuccessRate, failedProofCount }: {
    gpuLaneCount: number
    totalQueued: number
    totalAvailableSessions: number
    lowestSuccessRate: number
    failedProofCount: number
}) {
    if (!gpuLaneCount) {
        return { state: 'degraded', label: 'No live model lanes', message: 'Users can queue work, but no GPU model lanes are currently reporting capacity.' }
    }
    if (lowestSuccessRate < 0.8) {
        return { state: 'degraded', label: 'Verification failures elevated', message: 'Build or deploy checks are failing often enough that published progress may slow down.' }
    }
    if (totalQueued > Math.max(3, totalAvailableSessions * 2)) {
        return { state: 'busy', label: 'Queue pressure', message: 'More work is queued than currently available lane capacity can absorb quickly.' }
    }
    if (failedProofCount > 0) {
        return { state: 'watching', label: 'Validation failures present', message: 'Some checks failed in this window; users can still work while the system tracks the categories.' }
    }
    return { state: 'operational', label: 'Users can get work done', message: 'Model lanes, verification, and deploy checks are reporting normal capacity.' }
}
