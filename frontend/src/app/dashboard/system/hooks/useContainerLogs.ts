import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import config from '@/config'
import type { RuntimeLog } from '@/utils/logs/getLogs'
import { systemExpiredSessionPath } from '../systemRoutes'

export function useContainerLogs(id: string, token: string, containerName?: string) {
    const router = useRouter()
    const [logs, setLogs] = useState<RuntimeLog[]>([])
    const [logsReason, setLogsReason] = useState('')
    const [logsLoading, setLogsLoading] = useState(false)
    const abortController = useRef<AbortController | null>(null)

    const loadContainerLogs = useCallback(async (container: Pick<DockerContainer, 'name'> | null) => {
        abortController.current?.abort()
        if (!container) {
            setLogs([])
            setLogsReason('')
            return
        }
        const request = new AbortController()
        abortController.current = request
        setLogsLoading(true)
        setLogsReason('')
        const params = new URLSearchParams({ limit: '120', service: container.name })
        try {
            const response = await fetch(`${config.url.api}/logs/realtime?${params.toString()}`, {
                cache: 'no-store', headers: { id, Authorization: `Bearer ${token}` }, signal: request.signal,
            })
            if (response.status === 401) {
                router.push(systemExpiredSessionPath())
                return
            }
            if (!response.ok) throw new Error(await response.text())
            const body = await response.json()
            setLogs(Array.isArray(body.logs) ? body.logs as RuntimeLog[] : [])
            setLogsReason(typeof body.unavailable_reason === 'string' ? body.unavailable_reason : '')
        } catch (error) {
            if (request.signal.aborted) return
            setLogs([])
            setLogsReason(error instanceof Error ? error.message : 'Unable to load container logs.')
        } finally {
            if (!request.signal.aborted) setLogsLoading(false)
        }
    }, [id, router, token])

    useEffect(() => {
        void loadContainerLogs(containerName ? { name: containerName } : null)
    }, [containerName, loadContainerLogs])

    return { logs, logsReason, logsLoading, loadContainerLogs }
}
