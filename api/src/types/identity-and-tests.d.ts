type User = {
    id: string
    name: string
    avatar: string
}

type Test = {
    id: number
    url: string
    timeout: number
    stages: object & { default: boolean }
    status: string
    queue_position?: number
    logs: object[]
    errors: object[]
    duration: { milliseconds: number }
    created_at: string
    finished_at: string
    exit_code: number
    visits: number
    summary: any
    started_at?: string
    latest_run_summary?: any
    previous_run_summary?: any
    latest_run_number?: number
    p95_delta_ms?: number | null
}

