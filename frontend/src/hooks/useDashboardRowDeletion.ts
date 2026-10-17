import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export type DashboardRowDeletionOutcome = { deleted: boolean; error?: string }

export async function applyDashboardRowDeletion(
    remove: () => Promise<DashboardRowDeletionOutcome>,
    onDeleted: () => void,
    onError: (message: string) => void,
) {
    const outcome = await remove()
    if (outcome.deleted) onDeleted()
    else onError(outcome.error ?? '')
}

export function useDashboardRowDeletion() {
    const [deleted, setDeleted] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const router = useRouter()
    const deleteRow = useCallback((remove: () => Promise<DashboardRowDeletionOutcome>) =>
        applyDashboardRowDeletion(remove, () => {
            setDeleted(true)
            router.refresh()
        }, setError), [router, setError])

    return { deleted, error, deleteRow }
}
