import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import config from '@/config'
import { normalizeDockerTelemetry, normalizeSystemTelemetry } from '../systemPresentation'
import { responseErrorMessage } from '../client/presentation'
import { systemExpiredSessionPath } from '../systemRoutes'

export function useSystemTelemetry({ id, token, systemTelemetry, dockerTelemetry: initialDockerTelemetry, onError }: {
    id: string
    token: string
    systemTelemetry: SystemMetricsApiResponse
    dockerTelemetry: DockerTelemetryResponse
    onError: (message: string) => void
}) {
    const router = useRouter()
    const initialSystem = useMemo(() => normalizeSystemTelemetry(systemTelemetry), [systemTelemetry])
    const [systemSnapshot, setSystemSnapshot] = useState<SystemSnapshot | null>(initialSystem.system)
    const [systemUnavailableReason, setSystemUnavailableReason] = useState(initialSystem.unavailable_reason || '')
    const [dockerTelemetry, setDockerTelemetry] = useState(() => normalizeDockerTelemetry(initialDockerTelemetry))
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const refreshAll = useCallback(async (selectedContainerId: string, onSelectContainer: (id: string) => void) => {
        setRefreshing(true)
        try {
            const [metricsResponse, dockerResponse] = await Promise.all([
                fetch(`${config.url.api}/metrics`, { cache: 'no-store', headers: { id, Authorization: `Bearer ${token}` } }),
                fetch(`${config.url.api}/docker`, { cache: 'no-store', headers: { id, Authorization: `Bearer ${token}` } }),
            ])
            if (metricsResponse.status === 401 || dockerResponse.status === 401) {
                router.push(systemExpiredSessionPath())
                return
            }
            if (metricsResponse.ok) {
                const telemetry = normalizeSystemTelemetry(await metricsResponse.json())
                setSystemSnapshot(telemetry.system)
                setSystemUnavailableReason(telemetry.unavailable_reason || '')
            } else {
                setSystemUnavailableReason(await responseErrorMessage(metricsResponse, 'System telemetry'))
            }
            if (dockerResponse.ok) {
                const telemetry = normalizeDockerTelemetry(await dockerResponse.json())
                setDockerTelemetry(telemetry)
                if (!selectedContainerId && telemetry.containers[0]?.id) onSelectContainer(telemetry.containers[0].id)
            } else {
                const reason = await responseErrorMessage(dockerResponse, 'Docker telemetry')
                setDockerTelemetry((current) => ({ ...current, source: 'unavailable', unavailable_reason: reason, generated_at: new Date().toISOString() }))
            }
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Unable to refresh system telemetry.')
        } finally {
            setRefreshing(false)
        }
    }, [id, onError, router, token])

    useEffect(() => {
        if (!autoRefresh) return
        let disposed = false
        let socket: WebSocket | undefined
        let retry: ReturnType<typeof setTimeout> | undefined
        const connect = () => {
            if (disposed) return
            socket = new WebSocket(`${config.url.api_wss}/system`)
            socket.onopen = () => socket?.send(JSON.stringify({ type: 'auth', id, token }))
            socket.onmessage = event => {
                try {
                    const message = JSON.parse(event.data)
                    if (message.type === 'snapshot') {
                        const system = normalizeSystemTelemetry(message.system)
                        setSystemSnapshot(system.system)
                        setSystemUnavailableReason(system.unavailable_reason || '')
                        setDockerTelemetry(normalizeDockerTelemetry(message.docker))
                    } else if (message.type === 'error') setSystemUnavailableReason(message.message)
                } catch { setSystemUnavailableReason('Unable to read system telemetry.') }
            }
            socket.onclose = event => {
                if (disposed) return
                setSystemUnavailableReason(event.code === 1008 ? 'Sign in as a Hanasand organization owner or editor to view live telemetry.' : 'System telemetry is reconnecting.')
                if (event.code !== 1008) retry = setTimeout(connect, 2000)
            }
        }
        connect()
        return () => { disposed = true; clearTimeout(retry); socket?.close() }
    }, [autoRefresh, id, token])

    return { systemSnapshot, systemUnavailableReason, dockerTelemetry, autoRefresh, setAutoRefresh, refreshing, refreshAll }
}
