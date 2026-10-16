export type QueueDepthRow = {
    lane: string
    kind: string
    status: string
    count: string | number
}

export type VerificationLatencyRow = {
    kind: string
    p50_ms: string | number | null
    p95_ms: string | number | null
    sample_count: string | number
}

export type BuildDeployRow = {
    kind: string
    completed: string | number
    failed: string | number
    cancelled: string | number
    total: string | number
}

export type FailedProofRow = {
    category: string
    kind: string
    count: string | number
}

export type TimingRow = {
    p50_ms: string | number | null
    p95_ms: string | number | null
    sample_count: string | number
}
