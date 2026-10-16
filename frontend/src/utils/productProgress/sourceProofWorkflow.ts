import type { ProductReadinessEndToEndWorkflowReadiness } from './sourceGrowthTypes'
import type { ReadinessStatus } from './readinessTypes'

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

export function normalizeEndToEndWorkflowReadiness(input: ProductReadinessEndToEndWorkflowReadiness | undefined): ProductReadinessEndToEndWorkflowReadiness & {
    status: ReadinessStatus
    detail: string
    readyStepCount: number
    blockedStepCount: number
    stepCount: number
    missingFieldCount: number
} {
    if (!input || input.schemaVersion !== 'hanasand.product_readiness.end_to_end_workflow_packet.v1') {
        return {
            schemaVersion: 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
            state: 'unsupported',
            status: 'blocked',
            detail: 'End-to-end customer process state is loading through the source API proxy.',
            steps: [],
            typedFields: [],
            missingTypedFields: ['end_to_end_workflow_packet'],
            blockerCodes: ['missing_end_to_end_workflow_packet'],
            stepCount: 0,
            readyStepCount: 0,
            blockedStepCount: 1,
            missingFieldCount: 1,
        }
    }
    const steps = input.steps || []
    const readyStepCount = steps.filter(step => step.state === 'ready').length
    const blockedStepCount = steps.filter(step => step.state && step.state !== 'ready').length
    const missingFieldCount = input.missingTypedFields?.length || steps.reduce((sum, step) => sum + (step.missingTypedFields?.length || 0), 0)
    const status: ReadinessStatus = input.state === 'ready'
        ? 'ready'
        : input.state === 'partial'
            ? 'needs_action'
            : 'blocked'
    const blockerSummary = uniqueStrings([
        ...(input.blockerCodes || []),
        ...steps.flatMap(step => step.blockerCodes || []),
    ])
    const detail = status === 'ready'
        ? `${readyStepCount}/${steps.length} workflow steps are backed across org, watchlist, source, alert, case, webhook, and support.`
        : [
            `${readyStepCount}/${steps.length || input.requiredStepIds?.length || 0} workflow steps are backed.`,
            `${blockedStepCount || blockerSummary.length} step${(blockedStepCount || blockerSummary.length) === 1 ? '' : 's'} need live status.`,
            missingFieldCount ? `${missingFieldCount} typed field${missingFieldCount === 1 ? '' : 's'} syncing.` : '',
        ].filter(Boolean).join(' ')
    return {
        ...input,
        status,
        detail,
        stepCount: steps.length,
        readyStepCount,
        blockedStepCount,
        missingFieldCount,
    }
}

export function minutesBetween(from: string, to: string) {
    const fromTime = new Date(from).getTime()
    const toTime = new Date(to).getTime()
    if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return Number.POSITIVE_INFINITY
    return Math.max(0, Math.round((toTime - fromTime) / 60000))
}
