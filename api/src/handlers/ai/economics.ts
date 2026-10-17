import type { FastifyReply, FastifyRequest } from 'fastify'
import { readModelState } from './getModels.ts'
import { requireAiUser } from './shared.ts'
import { buildReliability } from './economics/reliability.ts'
import { numberValue } from './economics/numberValue.ts'
import type { BuildDeployRow, FailedProofRow, QueueDepthRow, TimingRow, VerificationLatencyRow } from './economics/reliabilityTypes.ts'
import type { DeploymentReadinessRow, DesignQualityRow, LatestDeploymentRow, LatestReleaseRow, LatestVerificationJobRow, ReleaseReadinessRow, UsageEconomicsRow, RecentRunRow } from './economics/types.ts'
import { loadUsageMetrics } from './economics/usageMetrics.ts'
import { loadReliabilityMetrics } from './economics/reliabilityMetrics.ts'
import { loadReadinessMetrics } from './economics/readinessMetrics.ts'
import { buildCommercialReadiness } from './economics/commercialReadiness.ts'
import { KEY_METRIC_LABEL } from './economics/constants.ts'
import { pricingModes, subscriptionTiers } from './economics/pricing.ts'

export { buildCommercialReadiness } from './economics/commercialReadiness.ts'

function clampDays(days: number) {
    if (!Number.isFinite(days)) return 30
    return Math.min(90, Math.max(7, Math.trunc(days)))
}

export async function getAiEconomics(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) return

    const days = clampDays(Number((req.query as { days?: string })?.days) || 30)
    const since = `${days} days`
    const [usageMetrics, reliabilityMetrics, readinessMetrics] = await Promise.all([
        loadUsageMetrics(userId, since),
        loadReliabilityMetrics(userId, since),
        loadReadinessMetrics(userId, since),
    ])
    const { summaryResult, trendResult, recentResult, cacheResult } = usageMetrics
    const {
        queueResult,
        verificationLatencyResult,
        buildDeployResult,
        failedProofResult,
        firstOutputResult,
        deployTimingResult,
    } = reliabilityMetrics
    const {
        designQualityResult,
        deploymentReadinessResult,
        releaseReadinessResult,
        latestVerificationResult,
        latestDeploymentResult,
        latestReleaseResult,
    } = readinessMetrics

    const summary = summaryResult.rows[0] || {}
    const cache = cacheResult.rows[0] || {}
    const verifiedUnits = numberValue(summary.verified_units)
    const costNok = numberValue(summary.estimated_cost_nok)
    const eventCount = numberValue(summary.event_count)
    const denominator = costNok > 0 ? costNok : 1
    const productiveMinutes = numberValue(summary.build_minutes) + numberValue(summary.deploy_minutes)
    const verifiedProgressPerMinutePerNok = productiveMinutes > 0 && costNok > 0
        ? verifiedUnits / productiveMinutes / costNok
        : 0
    const reliability = buildReliability({
        clients: (await readModelState()).connected,
        estimatedCostNok: costNok,
        queueRows: queueResult.rows as QueueDepthRow[],
        latencyRows: verificationLatencyResult.rows as VerificationLatencyRow[],
        buildDeployRows: buildDeployResult.rows as BuildDeployRow[],
        failedProofRows: failedProofResult.rows as FailedProofRow[],
        firstOutput: firstOutputResult.rows[0] as TimingRow | undefined,
        deployTiming: deployTimingResult.rows[0] as TimingRow | undefined,
    })
    const commercialReadiness = buildCommercialReadiness({
        reliability,
        deployment: deploymentReadinessResult.rows[0] as DeploymentReadinessRow | undefined,
        release: releaseReadinessResult.rows[0] as ReleaseReadinessRow | undefined,
        designQuality: designQualityResult.rows[0] as DesignQualityRow | undefined,
        latestVerificationJobs: latestVerificationResult.rows as LatestVerificationJobRow[],
        latestDeployment: latestDeploymentResult.rows[0] as LatestDeploymentRow | undefined,
        latestRelease: latestReleaseResult.rows[0] as LatestReleaseRow | undefined,
        eventCount,
        verifiedUnits,
        costNok,
        productiveMinutes,
    })

    return res.send({
        windowDays: days,
        keyMetric: KEY_METRIC_LABEL,
        summary: {
            eventCount,
            tokenUnits: numberValue(summary.token_units),
            billableUnits: numberValue(summary.billable_units),
            estimatedCostNok: costNok,
            verifiedUnits,
            verifiedProgressPerNok: verifiedUnits / denominator,
            verifiedProgressPerMinutePerNok,
            productiveMinutes,
            platformErrorUnits: numberValue(summary.platform_error_units),
            browserProofs: numberValue(summary.browser_proofs),
            buildMinutes: numberValue(summary.build_minutes),
            deployMinutes: numberValue(summary.deploy_minutes),
            cacheHits: numberValue(cache.cache_hits),
            cacheableEvents: numberValue(cache.cacheable_events),
            failedPlatformDiscountNok: numberValue(summary.failed_platform_discount_nok),
        },
        modes: pricingModes(),
        subscriptionTiers: subscriptionTiers(),
        reliability,
        commercialReadiness,
        trend: (trendResult.rows as UsageEconomicsRow[]).map((row) => ({
            bucket: row.bucket,
            eventCount: numberValue(row.event_count),
            tokenUnits: numberValue(row.token_units),
            billableUnits: numberValue(row.billable_units),
            estimatedCostNok: numberValue(row.estimated_cost_nok),
            verifiedUnits: numberValue(row.verified_units),
            platformErrorUnits: numberValue(row.platform_error_units),
        })),
        recentRuns: (recentResult.rows as RecentRunRow[]).map((row) => ({
            id: String(row.id),
            kind: row.kind,
            units: numberValue(row.units),
            billableUnits: numberValue(row.billable_units),
            estimatedCostNok: numberValue(row.estimated_cost_nok),
            billingMode: row.billing_mode,
            outcome: row.outcome,
            metadata: row.metadata || {},
            createdAt: row.created_at,
        })),
    })
}
