import type { ReactNode } from 'react'

export type SystemDashboardProps = {
    id: string
    token: string
    systemTelemetry: SystemMetricsApiResponse
    dockerTelemetry: DockerTelemetryResponse
    vms: VM[]
    vmMetrics: VMMetrics[]
    section: 'overview' | 'virtual-machines' | 'containers'
}

export type SystemSummary = {
    label: string
    value: string
    note: string
    icon: ReactNode
    tone?: 'ok' | 'warn' | 'bad'
}
