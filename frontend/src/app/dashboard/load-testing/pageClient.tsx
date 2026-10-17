'use client'

import { useRouter } from 'next/navigation'
import type { SyntheticEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import { postTest } from '@/utils/test/postTest'
import { ActiveLoadTests } from './ActiveLoadTests'
import { LoadTestHistory } from './LoadTestHistory'
import { LoadTestingLaunch } from './LoadTestingLaunch'
import { dedupeScans, isValidServiceUrl, loadTestStatusCounts, scenarioPresets } from './loadTestingScenarios'

export default function LoadTestingOperations() {
    const router = useRouter()
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [myScans, setMyScans] = useState<Test[]>([])
    const [loadedAt, setLoadedAt] = useState<Date | null>(null)
    const [targetUrl, setTargetUrl] = useState('')
    const [scenarioId, setScenarioId] = useState<(typeof scenarioPresets)[number]['id']>(scenarioPresets[0].id)
    const [historyView, setHistoryView] = useState<'mine' | 'global'>('mine')
    const [permissionConfirmed, setPermissionConfirmed] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [error, setError] = useState('')
    const scenario = scenarioPresets.find(preset => preset.id === scenarioId) ?? scenarioPresets[0]
    const validTarget = isValidServiceUrl(targetUrl)

    useEffect(() => {
        let active = true
        async function loadScans() {
            const [recent, mine] = await Promise.all([fetchRecentTests('recent', 8), fetchRecentTests('mine', 8)])
            if (!active) return
            setRecentScans(recent)
            setMyScans(mine)
            setLoadedAt(new Date())
        }
        void loadScans()
        const timer = window.setInterval(() => void loadScans(), 30_000)
        return () => { active = false; window.clearInterval(timer) }
    }, [])

    const allScans = useMemo(() => dedupeScans([...myScans, ...recentScans]), [myScans, recentScans])
    const activeScans = allScans.filter(scan => !['done', 'failed', 'error'].includes(scan.status.toLowerCase()))
    const { queued: queuedCount, running: runningCount, failed: failedCount } = loadTestStatusCounts(allScans)

    async function startCheck(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!validTarget || !permissionConfirmed || isStarting) return
        setIsStarting(true)
        setError('')
        const result = await postTest({ url: targetUrl, timeout: scenario.timeout, stages: scenario.stages })
        setIsStarting(false)
        if (!result.ok) { setError(result.error); return }
        router.push(`/test/${result.test.id}`)
    }

    return <div className='grid gap-4'>
        <LoadTestingLaunch
            targetUrl={targetUrl}
            onTargetUrlChange={setTargetUrl}
            scenario={scenario}
            selectedScenarioId={scenario.id}
            onScenarioChange={setScenarioId}
            permissionConfirmed={permissionConfirmed}
            onPermissionChange={setPermissionConfirmed}
            validTarget={validTarget}
            isStarting={isStarting}
            error={error}
            onSubmit={startCheck}
            runningCount={runningCount}
            queuedCount={queuedCount}
            scanCount={allScans.length}
            failedCount={failedCount}
            latestScan={allScans[0]}
            loadedAt={loadedAt}
        />
        <ActiveLoadTests scans={activeScans} scenario={scenario} />
        <LoadTestHistory historyView={historyView} onHistoryViewChange={setHistoryView} scans={historyView === 'mine' ? myScans : recentScans} />
    </div>
}
