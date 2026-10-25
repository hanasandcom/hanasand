export type RuntimeContainer = {
    id: string
    name: string
    image: string
    state: string
    status: string
    created_at: string
    ports?: RuntimeContainerPort[]
    restart_count?: number
    health?: string
    uptime_seconds?: number | null
    stats?: RuntimeContainerStats | null
    stats_unavailable_reason?: string
    stats_updated_at?: string
}

export type RuntimeLogEntry = {
    id: string
    container_id: string
    service: string
    image: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    created_at: string
    source: 'runtime'
}

export type RuntimeContainerPort = {
    ip?: string
    private_port: number
    public_port?: number
    type: string
}

export type RuntimeContainerStats = {
    cpu_percent: number | null
    memory_bytes: number | null
    memory_limit_bytes: number | null
    memory_percent: number | null
}

export type DockerContainerResponse = {
    Id: string
    Names?: string[]
    Image?: string
    State?: string
    Status?: string
    Created?: number
    Ports?: {
        IP?: string
        PrivatePort?: number
        PublicPort?: number
        Type?: string
    }[]
}

export type DockerInspectResponse = {
    Id?: string
    Name?: string
    Created?: string
    Config?: { Env?: string[], Cmd?: string[], Labels?: Record<string, string> }
    HostConfig?: { NetworkMode?: string }
    Args?: string[]
    RestartCount?: number
    State?: {
        Running?: boolean
        StartedAt?: string
        Health?: {
            Status?: string
        }
    }
    NetworkSettings?: {
        Ports?: Record<string, Array<{ HostIp: string, HostPort: string }> | null>
        Networks?: Record<string, {
            IPAddress?: string
        }>
    }
}

export type DockerStatsResponse = {
    read?: string
    cpu_stats?: {
        online_cpus?: number
        system_cpu_usage?: number
        cpu_usage?: {
            total_usage?: number
            percpu_usage?: number[]
        }
    }
    precpu_stats?: {
        system_cpu_usage?: number
        cpu_usage?: {
            total_usage?: number
        }
    }
    memory_stats?: {
        usage?: number
        limit?: number
        stats?: {
            inactive_file?: number
            cache?: number
        }
    }
}
