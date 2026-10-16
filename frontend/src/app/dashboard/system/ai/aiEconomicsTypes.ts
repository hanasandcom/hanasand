export type AIEconomics = {
    windowDays: number
    keyMetric: string
    summary: {
        eventCount: number
        tokenUnits: number
        billableUnits: number
        estimatedCostNok: number
        verifiedUnits: number
        verifiedProgressPerNok: number
        verifiedProgressPerMinutePerNok: number
        productiveMinutes: number
        platformErrorUnits: number
        browserProofs: number
        buildMinutes: number
        deployMinutes: number
        cacheHits: number
        cacheableEvents: number
        failedPlatformDiscountNok: number
    }
    modes: {
        id: string
        label: string
        priority: number
        concurrency: number
        verification: string
        discountFailedPlatformRuns: boolean
    }[]
    subscriptionTiers: {
        id: string
        label: string
        outcomeAllowance: number
        queuePriority: string
        concurrency: number
        fit?: string
        features?: string[]
    }[]
    reliability: {
        incidentStatus: { state: string, label: string, message: string }
        queueDepth: { lane: string, model: string, kind: string, status: string, count: number }[]
        verificationLatency: { kind: string, p50Ms: number, p95Ms: number, sampleCount: number }[]
        buildDeploy: { kind: string, completed: number, failed: number, cancelled: number, total: number, successRate: number }[]
        failedProofCategories: { category: string, kind: string, count: number }[]
        gpuLanes: {
            clientName: string
            lane: string
            model: string
            status: string
            tier: string
            activeSessions: number
            queuedSessions: number
            maxSessions: number
            availableSessions: number
            contextMaxTokens: number
            memoryUsedMb: number
            memoryTotalMb: number
            gpuLoad: number
            powerWatts: number
            powerLimitWatts: number
            temperatureC: number
        }[]
        costPerSuccessfulVerifiedBuildNok: number
        promptTiming: { p50FirstUsefulOutputMs: number, p95FirstUsefulOutputMs: number, sampleCount: number }
        deployTiming: { p50PromptToVerifiedDeployMs: number, p95PromptToVerifiedDeployMs: number, sampleCount: number }
        capacity: { totalQueued: number, totalActiveSessions: number, totalAvailableSessions: number }
    }
    commercialReadiness: {
        overallState: string
        conclusion: string
        achievedCount: number
        partialCount: number
        internalActionCount: number
        measurableCount: number
        totalCount: number
        items: {
            id: string
            priority: number
            label: string
            status: 'operational' | 'evidence_gap' | 'internal_action'
            evidence: string[]
            action: string
            owner: string
            control: string
            lastAttempt: string
            measurable: boolean
        }[]
    }
    trend: {
        bucket: string
        eventCount: number
        tokenUnits: number
        billableUnits: number
        estimatedCostNok: number
        verifiedUnits: number
        platformErrorUnits: number
    }[]
    recentRuns: {
        id: string
        kind: string
        units: number
        billableUnits: number
        estimatedCostNok: number
        billingMode: string
        outcome: string
        metadata: Record<string, unknown>
        createdAt: string
    }[]
}
