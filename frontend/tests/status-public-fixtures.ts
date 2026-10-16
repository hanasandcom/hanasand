import type { ServiceStatus } from '@/utils/status/getStatus'

export function serviceCheck(service: string, check_name: string, checked_at: string): ServiceStatus['checks'][number] {
    return { service, check_name, checked_at, status: 'up', latency_ms: 20, message: null, uptime_30d: '100.00' }
}
