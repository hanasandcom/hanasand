'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { BackupOperation } from '@/utils/db/internal'

export function useBackupOperationRefresh(isPending: boolean, activeOperation: BackupOperation | null | undefined) {
    const router = useRouter()

    useEffect(() => {
        if (!isPending && !activeOperation) return
        const timer = window.setInterval(() => router.refresh(), 1500)
        return () => window.clearInterval(timer)
    }, [activeOperation, isPending, router])
}
