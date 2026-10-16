import { useCallback, useState } from 'react'
import type { useRouter } from 'next/navigation'
import type { WorkbenchActionOutcome } from './types'

export type WorkbenchPersistentAction = (key: string, action: () => Promise<string>) => Promise<void>

export function useWorkbenchActionState(router: ReturnType<typeof useRouter>) {
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [message, setMessage] = useState<WorkbenchActionOutcome | null>(null)
    const runPersistentAction = useCallback(async (key: string, action: () => Promise<string>) => {
        if (busyAction) return
        setBusyAction(key)
        setMessage(null)
        try {
            const text = await action()
            setMessage({ ok: true, text })
            router.refresh()
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }, [busyAction, router])
    return { busyAction, message, setMessage, runPersistentAction }
}
