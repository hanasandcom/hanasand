'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BackupOperation } from '@/utils/db/internal'

type OperationResponse = { message: string, operation: BackupOperation } | string

export function useBackupOperationAction() {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [feedback, setFeedback] = useState<{ message: string, error: string, result: BackupOperation | null }>({ message: '', error: '', result: null })

    function run(action: () => Promise<OperationResponse>) {
        setFeedback({ message: '', error: '', result: null })
        startTransition(async() => {
            const response = await action()
            setFeedback(typeof response === 'string'
                ? { message: '', error: response, result: null }
                : { message: response.message, error: '', result: response.operation })
            router.refresh()
        })
    }

    return { isPending, ...feedback, run }
}
