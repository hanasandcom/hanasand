import {
    applyTrafficBatch,
    COUNTRY_EXPIRY_MS,
    hydrateCountries,
    INITIAL_VIEWBOX,
    PING_LIFETIME_MS,
    type LivePing,
    type TrafficBatch,
    type TrafficCountryPoint,
    type ViewBox,
} from '@/utils/monitoring/liveTrafficMap'
import type { TrafficMetrics, TrafficRecord, TrafficRecords } from '@/utils/monitoring/types'
import { useEffect, useRef, useState } from 'react'

export type TrafficSnapshotPayload = {
    records?: TrafficRecords | null
    metrics?: TrafficMetrics | null
}

type Options = {
    initialMetrics: TrafficMetrics | null
    initialRecords: TrafficRecord[]
    selectedDomain?: string
    onSnapshot?: (snapshot: TrafficSnapshotPayload) => void
}

export function useTrafficMapStream({ initialMetrics, initialRecords, selectedDomain, onSnapshot }: Options) {
    const [status, setStatus] = useState('Connecting traffic stream')
    const [isConnected, setIsConnected] = useState(false)
    const [isPolling, setIsPolling] = useState(false)
    const [liveRevision, setLiveRevision] = useState(0)
    const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX)
    const [pings, setPings] = useState<LivePing[]>([])
    const [countries, setCountries] = useState<Record<string, TrafficCountryPoint>>(() => hydrateCountries(initialRecords))
    const [liveRecords, setLiveRecords] = useState<TrafficRecord[]>(initialRecords)
    const [selectedCountry, setSelectedCountry] = useState<string>('NO')
    const [now, setNow] = useState(() => Date.now())
    const dragRef = useRef<{ x: number, y: number, viewBox: ViewBox } | null>(null)
    const frameRef = useRef<number>(0)
    const cursorRef = useRef(Math.max(0, ...initialRecords.map(record => Number(record.id) || 0)))
    const recordCountRef = useRef(initialRecords.length)

    useEffect(() => {
        recordCountRef.current = liveRecords.length
    }, [liveRecords.length])

    useEffect(() => {
        let es: EventSource | null = null
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        let stopped = false

        const connect = () => {
            if (stopped) return
            setStatus('Connecting traffic stream')
            es = new EventSource('/api/live-traffic?' + new URLSearchParams({ after: String(cursorRef.current), ...(selectedDomain ? { domain: selectedDomain } : {}) }))

            const handleBatch = (data: string) => {
                if (!data || data === 'connected') return
                try {
                    const batch = JSON.parse(data) as TrafficBatch[]
                    if (Array.isArray(batch) && batch.length) {
                        if (!Number(initialMetrics?.total_requests)) setLiveRevision(previous => previous + 1)
                        cursorRef.current = Math.max(cursorRef.current, ...batch.map(item => Number(item.max_id) || 0))
                        applyTrafficBatch(batch, setCountries, setPings)
                        setStatus('Streaming live traffic')
                        setIsConnected(true)
                        setIsPolling(false)
                    }
                } catch (error) {
                    console.error('Failed to parse live traffic batch:', error)
                }
            }

            es.onopen = () => {
                setStatus('Connected')
                setIsConnected(true)
                setIsPolling(false)
            }

            es.onmessage = (event) => {
                if (event.data === 'connected') {
                    setStatus('Connected')
                    setIsConnected(true)
                    setIsPolling(false)
                    return
                }
                handleBatch(event.data)
            }

            es.addEventListener('traffic', (event) => {
                handleBatch((event as MessageEvent).data)
            })

            es.addEventListener('ready', (event) => {
                setStatus((event as MessageEvent).data === 'snapshot' ? 'Traffic stream active' : 'Connected')
                setIsConnected(true)
                setIsPolling(false)
            })

            es.onerror = () => {
                setStatus(recordCountRef.current || Number(initialMetrics?.total_requests || 0) ? 'Live traffic feed active' : 'Polling traffic feed')
                setIsConnected(false)
                setIsPolling(true)
                es?.close()
                if (!stopped) {
                    reconnectTimer = setTimeout(connect, 3000)
                }
            }
        }

        connect()

        return () => {
            stopped = true
            es?.close()
            if (reconnectTimer) clearTimeout(reconnectTimer)
        }
    }, [])

    useEffect(() => {
        let stopped = false
        let timer: ReturnType<typeof setTimeout> | null = null

        async function pollSnapshot() {
            try {
                const response = await fetch('/api/live-traffic?' + new URLSearchParams({ mode: 'snapshot', ...(selectedDomain ? { domain: selectedDomain } : {}) }), { cache: 'no-store' })
                if (!response.ok) throw new Error(`Snapshot returned ${response.status}`)
                const payload = await response.json() as TrafficSnapshotPayload
                const records = Array.isArray(payload.records?.result) ? payload.records.result : []
                if (!stopped) {
                    if (payload.records) {
                        cursorRef.current = Math.max(cursorRef.current, ...records.map(record => Number(record.id) || 0))
                        setLiveRecords(records)
                        setCountries(hydrateCountries(records))
                    }
                    onSnapshot?.(payload)
                    setStatus(isConnected ? 'Streaming live traffic' : 'Updated')
                    setIsPolling(!isConnected)
                }
            } catch {
                if (!stopped && !isConnected) {
                    setStatus(recordCountRef.current || Number(initialMetrics?.total_requests || 0) ? 'Live traffic feed active; refresh retrying' : 'Traffic feed retrying')
                    setIsPolling(true)
                }
            } finally {
                if (!stopped) {
                    timer = setTimeout(pollSnapshot, isConnected ? 30000 : 10000)
                }
            }
        }

        pollSnapshot()

        return () => {
            stopped = true
            if (timer) clearTimeout(timer)
        }
    }, [isConnected, selectedDomain, onSnapshot, liveRevision])

    useEffect(() => {
        function tick() {
            const nextNow = Date.now()
            setNow(nextNow)
            setPings((prev) => prev.filter((ping) => nextNow - ping.startTime < PING_LIFETIME_MS))
            setCountries((prev) => Object.fromEntries(
                Object.entries(prev).filter(([, value]) => isConnected ? nextNow - value.lastSeen < COUNTRY_EXPIRY_MS : true)
            ))
            frameRef.current = requestAnimationFrame(tick)
        }

        frameRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frameRef.current)
    }, [])

    return {
        status, isConnected, isPolling, viewBox, setViewBox, pings, countries, setCountries,
        liveRecords, setLiveRecords, selectedCountry, setSelectedCountry, now, dragRef,
    }
}
