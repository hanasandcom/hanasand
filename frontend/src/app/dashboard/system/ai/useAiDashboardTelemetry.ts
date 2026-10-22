import { useEffect, useState } from 'react'
import config from '@/config'
import { getCookie } from 'hanasand/cookies'
import { aiClientRequest } from '@/utils/ai/client'
import { normalizeDockerTelemetry } from '../systemPresentation'
import type { AIEconomics } from './aiEconomicsTypes'

export function useAiDashboardTelemetry() {
    const [economics, setEconomics] = useState<AIEconomics | null>(null)
    const [economicsError, setEconomicsError] = useState<string | null>(null)
    const [aiContainers, setAiContainers] = useState<DockerContainer[]>([])
    const [containerError, setContainerError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function loadEconomics() {
            try {
                const response = await aiClientRequest('/ai/economics?days=30')
                if (!response.ok) throw new Error('Unable to load AI economics.')
                const data = await response.json()
                if (!cancelled) {
                    setEconomics(data as AIEconomics)
                    setEconomicsError(null)
                }
            } catch (error) {
                if (!cancelled) {
                    setEconomicsError(error instanceof Error ? error.message : 'Unable to load AI economics.')
                }
            }
        }

        void loadEconomics()
        const interval = window.setInterval(loadEconomics, 30_000)
        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        async function loadAiContainers() {
            const id = getCookie('id')
            const token = getCookie('access_token')
            if (!id || !token) {
                if (!cancelled) setContainerError('Log in again to inspect AI containers.')
                return
            }

            try {
                const response = await fetch(`${config.url.api}/docker`, {
                    cache: 'no-store',
                    headers: { id, Authorization: `Bearer ${token}` },
                })
                if (!response.ok) throw new Error('Docker telemetry is reconnecting.')
                const telemetry = normalizeDockerTelemetry(await response.json())
                const containers = telemetry.containers.filter(isAiContainer)
                if (!cancelled) {
                    setAiContainers(containers)
                    setContainerError(telemetry.unavailable_reason || null)
                }
            } catch (error) {
                if (!cancelled) {
                    setContainerError(error instanceof Error ? error.message : 'Docker telemetry is reconnecting.')
                }
            }
        }

        void loadAiContainers()
        const interval = window.setInterval(loadAiContainers, 30_000)
        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [])

    return { economics, economicsError, aiContainers, containerError }
}

function isAiContainer(container: DockerContainer) {
    return /(^|_)ai(_|$)|model|parser|gpt/i.test(`${container.name} ${container.image || ''}`)
}
