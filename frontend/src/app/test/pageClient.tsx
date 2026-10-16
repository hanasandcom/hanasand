'use client'

import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import copy from '@/utils/copy'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import { postTest } from '@/utils/test/postTest'
import { ArrowLeft, CheckCircle2, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SyntheticEvent, KeyboardEvent, useEffect, useState } from 'react'
import EndpointCheckPanel, { type ScenarioPreset } from './EndpointCheckPanel'

const freeTryLimit = 5
const freeTryStorageKey = 'hanasand:load-testing-free-tries-v2'
const scenarioPresets: ScenarioPreset[] = [
    { id: 'baseline', label: 'Baseline', detail: 'Single-user HTTP check.', stages: [{ duration: '30s', target: 1 }], timeout: 30000 },
    { id: 'ramp', label: 'Ramp', detail: 'Gradual traffic increase.', stages: [{ duration: '30s', target: 5 }, { duration: '1m', target: 20 }, { duration: '30s', target: 0 }], timeout: 45000 },
    { id: 'spike', label: 'Spike', detail: 'Short timeout burst.', stages: [{ duration: '15s', target: 5 }, { duration: '20s', target: 40 }, { duration: '25s', target: 0 }], timeout: 60000 },
]

export default function TestPageClient({ serverId, created, missingTestId }: { serverId?: string, created?: string, missingTestId?: string }) {
    const router = useRouter()
    const [path, setPath] = useState('')
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [freeTriesUsed, setFreeTriesUsed] = useState(0)
    const [loadTestQuota, setLoadTestQuota] = useState<LoadTestQuota | null>(null)
    const [scenarioId, setScenarioId] = useState(scenarioPresets[0].id)
    const [isStarting, setIsStarting] = useState(false)
    const selectedScenario = scenarioPresets.find((scenario) => scenario.id === scenarioId) ?? scenarioPresets[0]
    const fullUrl = `${config.url.link}/${serverId}`
    const remainingChecks = loadTestQuota?.remaining ?? Math.max(0, freeTryLimit - freeTriesUsed)
    const quotaLabel = loadTestQuota && loadTestQuota.plan !== 'free'
        ? `${remainingChecks} ${loadTestQuota.plan} check${remainingChecks === 1 ? '' : 's'} remaining this month`
        : `${remainingChecks} free check${remainingChecks === 1 ? '' : 's'} remaining`
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 350,
        onClear: () => setDidCopy(false)
    })

    useEffect(() => {
        let active = true
        fetchRecentTests('recent').then((recent) => {
            if (active) setRecentScans(recent)
        })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        setFreeTriesUsed(readFreeTriesUsed())
    }, [])

    async function handleSubmit(e: SyntheticEvent<HTMLElement>) {
        e.preventDefault()
        await startCheck()
    }

    async function handleEndpointKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key !== 'Enter') return
        e.preventDefault()
        await startCheck()
    }

    async function startCheck() {
        if (isStarting) return
        setError(null)

        const url = normalizeEndpoint(path)
        if (!isValidEndpoint(url)) {
            setError('Enter a full HTTP or HTTPS endpoint you control.')
            return
        }

        setIsStarting(true)
        const result = await postTest({ url, timeout: selectedScenario.timeout, stages: selectedScenario.stages })
        setIsStarting(false)
        if (!result.ok) {
            if (result.quota) {
                setLoadTestQuota(result.quota)
                if (result.quota.plan === 'free') setFreeTriesUsed(Math.min(freeTryLimit, result.quota.used))
            }
            setError(result.error)
            return
        }

        if (result.test.quota) {
            setLoadTestQuota(result.test.quota)
            if (result.test.quota.plan === 'free') setFreeTriesUsed(Math.min(freeTryLimit, result.test.quota.used))
        } else {
            setFreeTriesUsed(incrementFreeTriesUsed())
        }
        if (result.test.id) router.push(`/test/${result.test.id}`)
    }

    if (created) {
        return (
            <div className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm md:p-6'>
                <div className='grid gap-5'>
                    <div className='flex items-start justify-between gap-4'>
                        <div className='grid gap-1'>
                            <div className='flex items-center gap-2 text-lg font-semibold text-ui-text'>
                                <CheckCircle2 className='h-5 w-5 text-ui-success' />
                                Service check created
                            </div>
                            <p className='text-sm leading-6 text-ui-muted'>Copy the result link or start another check.</p>
                        </div>
                    </div>
                    <button type='button' onClick={() => copy({ text: fullUrl, setDidCopy })} className='flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-left transition hover:border-ui-primary'>
                        <Copy height={15} width={15} className={`shrink-0 ${didCopy === true ? 'stroke-ui-success' : didCopy === false ? 'stroke-ui-muted' : 'stroke-ui-danger'}`} />
                        <span className='min-w-0 break-all text-sm text-ui-text'>{fullUrl}</span>
                    </button>
                    <button type='button' onClick={() => router.push('/test')} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                        <ArrowLeft className='h-4 w-4' />
                        New check
                    </button>
                </div>
            </div>
        )
    }

    return <EndpointCheckPanel
        path={path}
        scenarioId={scenarioId}
        scenarios={scenarioPresets}
        selectedScenario={selectedScenario}
        quotaLabel={quotaLabel}
        missingTestId={missingTestId}
        error={error}
        starting={isStarting}
        recentScans={recentScans}
        onPathChange={setPath}
        onScenarioChange={setScenarioId}
        onSubmit={handleSubmit}
        onEndpointKeyDown={handleEndpointKeyDown}
        onNavigate={url => router.push(url)}
    />
}

function normalizeEndpoint(value: string) {
    return value.trim()
}

function isValidEndpoint(value: string) {
    try {
        const url = new URL(value)
        return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
    } catch {
        return false
    }
}

function readFreeTriesUsed() {
    try {
        return Math.max(0, Math.min(freeTryLimit, Number(window.localStorage.getItem(freeTryStorageKey) || '0') || 0))
    } catch {
        return 0
    }
}

function incrementFreeTriesUsed() {
    const next = Math.min(freeTryLimit, readFreeTriesUsed() + 1)
    try {
        window.localStorage.setItem(freeTryStorageKey, String(next))
    } catch {
        // The server check still runs; storage only gates the browser trial experience.
    }
    return next
}
