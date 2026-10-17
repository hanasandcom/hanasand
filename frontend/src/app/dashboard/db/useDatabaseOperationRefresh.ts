'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { BackupOperation } from '@/utils/db/internal'

export function useDatabaseOperationRefresh(
    activeOperation: BackupOperation | null | undefined, isPending = false, intervalMs = 1500,
) {
    const router = useRouter()

    useEffect(() => {
        if (!isPending && !activeOperation) return
        const timer = window.setInterval(() => router.refresh(), intervalMs)
        return () => window.clearInterval(timer)
    }, [activeOperation, intervalMs, isPending, router])
}
