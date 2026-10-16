export type QueueStatus = 'unresolved_reference' | 'anomaly' | 'awaiting_alert' | 'awaiting_delivery' | 'complete' | 'excluded'
export type Metric = { sampleSize: number, medianSeconds: number | null, p95Seconds: number | null, p99Seconds: number | null }
export type Item = {
    id: string
    incidentId: string
    summary?: string
    sources?: Array<{ title?: string, url?: string }>
    captureId: string
    sourceId: string
    actorName?: string
    sourceName?: string
    sourceFamily?: string
    title?: string
    exclusion?: { reason: string, reviewedBy: string, reviewedAt: string }
    reportRecovery?: { status: string, attempts?: number, reason?: string, nextAttemptAt?: string }
    status: QueueStatus
    missingStages: string[]
    stages: Record<string, string | undefined>
    provenance: Record<string, Record<string, unknown> | undefined>
    reportReferences: Array<Record<string, unknown>>
    latencies: Record<string, number | undefined>
    timestampAnomalies: string[]
    updatedAt?: string
}
export type GroupMetric = { name: string, recordCount: number, metrics: Record<string, Metric> }
export type QualityGroup = { name: string, recordCount: number, missing: Record<string, number>, issues: Record<string, number> }
export type ReferenceForm = { role: string, timestamp: string, referenceUrl: string, referenceTitle: string, evidencePath: string }
export type Snapshot = {
    generatedAt: string
    summary: {
        recordCount: number
        unresolvedReferenceCount: number
        anomalyCount: number
        awaitingAlertCount: number
        awaitingDeliveryCount: number
        completeCount: number
        observedCoverage: number
        reviewedCoverage: number
        reportToAlertCoverage: number
        reportToDeliveredCoverage: number
        excludedMetricRecordCount: number
    }
    metrics: { overall: Record<string, Metric>, bySourceFamily: GroupMetric[], byActor: GroupMetric[], byStage: Array<{ name: string } & Metric> }
    quality: {
        fields: Array<{ name: string, presentCount: number, missingCount: number, coverage: number }>
        issues: Array<{ name: string, count: number }>
        bySourceClass: QualityGroup[]
    }
    items: Item[]
    page: { total: number, nextCursor: string | null }
}

export const statuses: Array<{ value: '' | QueueStatus, label: string }> = [
    { value: '', label: 'All records' },
    { value: 'unresolved_reference', label: 'Needs first report' },
    { value: 'anomaly', label: 'Timestamp anomalies' },
    { value: 'awaiting_alert', label: 'Awaiting alert' },
    { value: 'awaiting_delivery', label: 'Awaiting delivery' },
    { value: 'complete', label: 'Complete' },
    { value: 'excluded', label: 'Rejected incidents' },
]

export const stageOrder = ['observed', 'first_report', 'publication', 'collection', 'processing', 'first_visible', 'reviewed', 'alert_created', 'delivery_attempt', 'delivered']
