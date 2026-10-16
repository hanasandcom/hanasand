import { expect, test } from 'bun:test'
import { buildReliability } from '../src/handlers/ai/economics/reliability.ts'

const lane = {
    id: 'lane-1', index: 0, url: 'http://gpu', gpuIndex: 0, gpuIndices: [0], gpuName: 'A100',
    gpuLoad: 0, activeRequests: 0, maxRequests: 4, queuedRequests: 0, availableRequests: 4,
    contextMaxTokens: 8_000, memoryUsedMb: 2_000, memoryTotalMb: 8_000,
    powerDrawWatts: 0, powerLimitWatts: 300, temperatureC: 40,
}

function input(overrides: Partial<Parameters<typeof buildReliability>[0]> = {}) {
    return {
        clients: [{
            name: 'client', ram: [], cpu: [], gpu: [], lanes: [lane],
            model: { conversationId: 'model-1', status: 'ready' },
        }],
        estimatedCostNok: 12,
        queueRows: [],
        latencyRows: [],
        buildDeployRows: [{ kind: 'build', completed: 8, failed: 2, cancelled: 0, total: 10 }],
        failedProofRows: [],
        ...overrides,
    } as Parameters<typeof buildReliability>[0]
}

test('normalizes GPU lanes and falls back to evenly divided client power', () => {
    const clients = [{
        name: 'worker', displayName: 'GPU worker', power: { totalWatts: 400 }, ram: [], cpu: [], gpu: [],
        model: { conversationId: 'conversation-model', status: 'ready' },
        lanes: [
            { ...lane, id: '', label: '', model: '', tier: undefined, activeRequests: '2', availableRequests: '3', powerDrawWatts: 180 },
            { ...lane, id: 'lane-2', label: 'GPU B', gpuIndex: 1, powerDrawWatts: 0, availableRequests: 5 },
        ],
    }] as unknown as GPT_Client[]

    expect(buildReliability(input({ clients })).gpuLanes).toEqual([
        {
            clientName: 'GPU worker', lane: 'GPU 1', model: 'conversation-model', status: 'ready', tier: 'fast',
            activeSessions: 2, queuedSessions: 0, maxSessions: 4, availableSessions: 3, contextMaxTokens: 8_000,
            memoryUsedMb: 2_000, memoryTotalMb: 8_000, gpuLoad: 0, powerWatts: 180, powerLimitWatts: 300, temperatureC: 40,
        },
        {
            clientName: 'GPU worker', lane: 'GPU B', model: 'conversation-model', status: 'ready', tier: 'fast',
            activeSessions: 0, queuedSessions: 0, maxSessions: 4, availableSessions: 5, contextMaxTokens: 8_000,
            memoryUsedMb: 2_000, memoryTotalMb: 8_000, gpuLoad: 0, powerWatts: 200, powerLimitWatts: 300, temperatureC: 40,
        },
    ])
})

test('normalizes numeric aggregates and computes queue/build totals', () => {
    const result = buildReliability(input({
        queueRows: [
            { lane: '', kind: '', status: 'queued', count: '2' },
            { lane: 'priority', kind: 'build', status: 'queued', count: '3.5' },
            { lane: 'priority', kind: 'build', status: 'running', count: '99' },
            { lane: 'bad', kind: 'build', status: 'queued', count: 'not-a-number' },
        ],
        latencyRows: [{ kind: 'build', p50_ms: '120', p95_ms: 'bad', sample_count: '4' }],
        buildDeployRows: [
            { kind: 'build', completed: '7', failed: '2', cancelled: '1', total: '10' },
            { kind: 'deploy', completed: '3', failed: '0', cancelled: '0', total: '3' },
            { kind: 'empty', completed: '5', failed: '0', cancelled: '0', total: '0' },
        ],
    }))

    expect(result.queueDepth).toEqual([
        { lane: 'standard', model: 'verification', kind: '', status: 'queued', count: 2 },
        { lane: 'priority', model: 'build', kind: 'build', status: 'queued', count: 3.5 },
        { lane: 'priority', model: 'build', kind: 'build', status: 'running', count: 99 },
        { lane: 'bad', model: 'build', kind: 'build', status: 'queued', count: 0 },
    ])
    expect(result.capacity).toEqual({ totalQueued: 5.5, totalActiveSessions: 0, totalAvailableSessions: 4 })
    expect(result.verificationLatency).toEqual([{ kind: 'build', p50Ms: 120, p95Ms: 0, sampleCount: 4 }])
    expect(result.buildDeploy).toEqual([
        { kind: 'build', completed: 7, failed: 2, cancelled: 1, total: 10, successRate: 0.7 },
        { kind: 'deploy', completed: 3, failed: 0, cancelled: 0, total: 3, successRate: 1 },
        { kind: 'empty', completed: 5, failed: 0, cancelled: 0, total: 0, successRate: 0 },
    ])
    expect(result.costPerSuccessfulVerifiedBuildNok).toBe(1.2)
})

test('incident precedence is no lanes, low success, queue pressure, failed proof, operational', () => {
    const noLanes = buildReliability(input({ clients: [], failedProofRows: [{ category: 'lint', kind: 'build', count: 1 }] }))
    expect(noLanes.incidentStatus).toEqual({
        state: 'degraded', label: 'No live model lanes',
        message: 'Users can queue work, but no GPU model lanes are currently reporting capacity.',
    })

    const lowSuccess = buildReliability(input({
        queueRows: [{ lane: 'lane', kind: 'build', status: 'queued', count: 9 }],
        buildDeployRows: [{ kind: 'build', completed: 7, failed: 3, cancelled: 0, total: 10 }],
        failedProofRows: [{ category: 'lint', kind: 'build', count: 1 }],
    }))
    expect(lowSuccess.incidentStatus).toEqual({
        state: 'degraded', label: 'Verification failures elevated',
        message: 'Build or deploy checks are failing often enough that published progress may slow down.',
    })

    const queuePressure = buildReliability(input({
        queueRows: [{ lane: 'lane', kind: 'build', status: 'queued', count: 9 }],
        failedProofRows: [{ category: 'lint', kind: 'build', count: 1 }],
    }))
    expect(queuePressure.incidentStatus).toEqual({
        state: 'busy', label: 'Queue pressure',
        message: 'More work is queued than currently available lane capacity can absorb quickly.',
    })

    const failedProof = buildReliability(input({ failedProofRows: [{ category: 'lint', kind: 'build', count: 1 }] }))
    expect(failedProof.incidentStatus).toEqual({
        state: 'watching', label: 'Validation failures present',
        message: 'Some checks failed in this window; users can still work while the system tracks the categories.',
    })

    expect(buildReliability(input()).incidentStatus).toEqual({
        state: 'operational', label: 'Users can get work done',
        message: 'Model lanes, verification, and deploy checks are reporting normal capacity.',
    })
})
