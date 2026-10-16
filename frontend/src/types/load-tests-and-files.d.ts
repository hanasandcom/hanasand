type LoadTestTimePoint = {
    time: string | number
}

type LoadTestRpsPoint = LoadTestTimePoint & {
    value: number
}

type LoadTestLatencyPoint = LoadTestTimePoint & {
    p50?: number
    p95?: number
}

type LoadTestErrorPoint = LoadTestTimePoint & {
    count: number
}

type LoadTestSummary = {
    requests?: number
    failureRate?: number
    duration?: {
        p50?: number
        p95?: number
        avg?: number
        min?: number
        max?: number
    }
    rps?: LoadTestRpsPoint[]
    latency?: LoadTestLatencyPoint[]
    errors?: LoadTestErrorPoint[]
}

type LoadTestQuota = {
    plan: 'free' | 'starter' | 'team' | 'volume'
    limit: number
    used: number
    remaining: number
    resetsAt?: string | null
}

type Test = {
    id: string
    url: string
    timeout: number
    stages: object & { default: boolean }
    status: string
    queue_position?: number
    logs: string[]
    errors: string[]
    duration: { milliseconds: number }
    created_at: string
    started_at?: string
    finished_at: string
    exit_code: number
    visits: number
    summary: LoadTestSummary
    latest_run_summary?: LoadTestSummary
    previous_run_summary?: LoadTestSummary
    latest_run_number?: number
    p95_delta_ms?: number | null
    quota?: LoadTestQuota
}

type FileItemBase = {
    id: string
    name: string
    alias: string | null
    parent: string | null
}

type FileFile = FileItemBase & {
    type: 'file'
}

type FileFolder = FileItemBase & {
    type: 'folder'
    children: FileItem[]
}

type FileItem = FileFile | FileFolder

type Log = {
    content: string
    timestamp: string
    type: 'stdout' | 'stderr'
}

type Tree = FileItem[]
