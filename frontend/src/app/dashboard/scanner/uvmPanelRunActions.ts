import type { Dispatch, SetStateAction } from 'react'
import type { UvmRun } from '@/utils/monitoring/types'
import type { UvmPanelProps } from './uvmPanelProps'

export async function cancelUvmPanelRun({ run, cancelRunAction, refresh, setBusy, setMessage }: {
    run: UvmRun
    cancelRunAction: UvmPanelProps['cancelRunAction']
    refresh: () => Promise<unknown>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
}) {
    setBusy(`run:${run.id}`); setMessage('')
    try { await cancelRunAction(run.id); await refresh(); setMessage(`Cancellation requested for ${run.target}.`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The scan could not be cancelled.') }
    finally { setBusy('') }
}
