import { formatCountLabel, formatNumber, formatVerificationAttempt, readinessItem, readinessStatus } from './formatting.ts'
import { KEY_METRIC_LABEL } from './constants.ts'
import type { CommercialReadinessContext } from './readinessContext.ts'

export function buildProductReadinessItems(context: CommercialReadinessContext) {
    const { reliability, hasMeasuredEconomics, eventCount, verifiedUnits, costNok, productiveMinutes, hasQueueTelemetry, hasPromptUxEvidence, hasVerificationSamples, designTotal, designCompleted, designFailed, designAvgScore, hasDesignProof, designPassRate, latestVerificationByKind, lastVerificationAttempt, hasDeployTimingEvidence } = context
    return [
        readinessItem({
            id: 'verified_outcome_economics',
            priority: 4,
            label: 'Cost and queue metrics tied to verified outcomes',
            status: readinessStatus(hasMeasuredEconomics && (hasQueueTelemetry || hasVerificationSamples), hasMeasuredEconomics || hasQueueTelemetry),
            evidence: [
                `Key metric is ${KEY_METRIC_LABEL}, currently ${formatNumber(reliability.costPerSuccessfulVerifiedBuildNok)} NOK per successful verified build or deploy check.`,
                hasMeasuredEconomics
                    ? `${verifiedUnits} verified units, ${productiveMinutes} productive minutes, and ${formatNumber(costNok)} NOK estimated cost in this window.`
                    : 'No verified cost events are recorded for this owner in the selected usage window.',
                hasQueueTelemetry
                    ? `${formatCountLabel(reliability.capacity.totalQueued, 'queued job')} are tied to live lane capacity.`
                    : 'No live queue capacity record is available for this owner.',
            ],
            action: hasMeasuredEconomics ? 'Review pricing cohorts against verified outcome events, not raw token totals.' : 'Record ai_usage_events with outcome=verified from verification/deploy flows before changing pricing.',
            owner: 'Product analytics',
            control: 'ai_usage_events joined to verification and deployment outcomes',
            lastAttempt: `${eventCount} AI usage events in the selected window.`,
            measurable: hasMeasuredEconomics || hasQueueTelemetry,
        }),
        readinessItem({
            id: 'non_developer_ux',
            priority: 5,
            label: 'Non-developer UX polish',
            status: hasPromptUxEvidence ? 'operational' : 'internal_action',
            evidence: [
                'User-facing states separate planning, editing, verification, needs-you, publish-ready, and failed-with-fix flows.',
                'Advanced logs remain secondary to plain operator actions, summaries, screenshots, and deploy diagnosis.',
                hasPromptUxEvidence
                    ? `${reliability.promptTiming.sampleCount} prompt-to-first-output timing samples are recorded in this window.`
                    : 'No prompt-to-first-output timing sample is recorded for this owner in the selected usage window.',
            ],
            action: 'Store prompt-to-next-action timing and first-run completion in ai_usage_events.metadata before promoting this gate to operational.',
            owner: 'Product',
            control: 'AI workspace UX state model and ai_usage_events.metadata',
            lastAttempt: `${reliability.promptTiming.sampleCount} prompt timing samples in the selected window.`,
            measurable: reliability.promptTiming.sampleCount > 0,
        }),
        readinessItem({
            id: 'design_quality',
            priority: 6,
            label: 'Better design QA and less generic output',
            status: readinessStatus(hasDesignProof && designPassRate >= 0.8 && designAvgScore >= 72, hasDesignProof),
            evidence: [
                'Design QA worker fetches pages, scores hierarchy/spacing/generic-copy signals, captures mobile and desktop screenshots, and persists design_quality_report artifacts.',
                hasDesignProof
                    ? `${designTotal} durable design QA jobs in this window: ${designCompleted} passed and ${designFailed} failed.`
                    : 'No durable design QA job is recorded for this owner in the selected usage window.',
                hasDesignProof
                    ? `Average design QA score is ${formatNumber(designAvgScore)} out of 100.`
                    : 'No design QA score is available for this owner.',
            ],
            action: hasDesignProof ? 'Attach before/after screenshot diff baselines to design_quality_report artifacts.' : 'Enqueue kind=design verification jobs for generated pages before marking visual work ready.',
            owner: 'Design systems',
            control: 'kind=design verification jobs and frontend copy guardrails',
            lastAttempt: formatVerificationAttempt(latestVerificationByKind.get('design')),
            measurable: hasDesignProof,
        }),
        readinessItem({
            id: 'tiered_pricing',
            priority: 7,
            label: 'Tiered pricing around verification and deploy capacity',
            status: 'operational',
            evidence: [
                'Free, Starter, Pro, Agency, and Business tiers are modeled around verified outcomes, queue priority, deploy features, concurrency, rollback, audit, and approvals.',
                'Cost controls include draft, standard, verified, and priority modes.',
                'Failed platform infrastructure runs are discounted separately from user value.',
            ],
            action: 'Calibrate allowances only from verified outcome cohorts recorded in ai_usage_events.',
            owner: 'Product analytics',
            control: 'pricingModes, subscriptionTiers, ai_usage_events economics',
            lastAttempt: `${verifiedUnits} verified units in the selected window.`,
            measurable: true,
        }),
        readinessItem({
            id: 'model_routing_after_measurement',
            priority: 8,
            label: 'Stronger model routing only after the pipeline is measurable',
            status: readinessStatus(hasVerificationSamples && hasMeasuredEconomics, hasVerificationSamples || hasMeasuredEconomics),
            evidence: [
                'Task routing already distinguishes tool-first deterministic paths, small local edits/summaries, and stronger architecture/refactor/bug-hunt work.',
                hasPromptUxEvidence || hasDeployTimingEvidence
                    ? `${formatCountLabel(reliability.promptTiming.sampleCount, 'prompt timing sample')} and ${formatCountLabel(reliability.deployTiming.sampleCount, 'deploy timing sample')} exist in this window.`
                    : 'No prompt or deploy timing sample is recorded for this owner in the selected usage window.',
                'Routing should be promoted based on verified useful progress, not raw tokens/sec.',
            ],
            action: hasVerificationSamples && hasMeasuredEconomics ? 'Promote routing changes only when verified outcome deltas beat cost deltas.' : 'Keep stronger-model expansion gated until verification and economics samples are dense enough.',
            owner: 'AI platform',
            control: 'task routing plus verified economics counters',
            lastAttempt: formatVerificationAttempt(lastVerificationAttempt),
            measurable: hasVerificationSamples || hasMeasuredEconomics,
        }),
    ]
}
