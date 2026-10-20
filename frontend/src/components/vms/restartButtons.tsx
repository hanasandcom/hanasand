'use client'

import manageVM from '@/utils/vms/fetch/manage/manage'
import { LoaderCircle, Play, RefreshCcw, StopCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { vmActionStyle } from './actionStyle'
import type { NotifyVmAction } from './vmActionFeedback'

export default function RestartButtons({ vm, onUpdated, onFeedback, showLabels = false }: { vm: VM, onUpdated?: () => void, onFeedback?: NotifyVmAction, showLabels?: boolean }) {
    const router = useRouter()
    const [loading, setLoading] = useState<'start' | 'stop' | 'restart' | null>(null)
    const [pendingAction, setPendingAction] = useState<'start' | 'stop' | null>(null)
    const [hydrated, setHydrated] = useState(false)
    const status = (vm.status || '').toLowerCase()
    const isRunning = ['running', 'frozen', 'stopping'].includes(status)
    const isStarting = status === 'starting'
    const canManage = Boolean(vm.name)
    const disabled = Boolean(loading || pendingAction || isStarting) || !hydrated || Boolean(vm.deleted_at)

    useEffect(() => {
        if (!pendingAction) return
        const reachedState = pendingAction === 'start'
            ? ['starting', 'running', 'frozen'].includes(status)
            : ['stopped', 'shut off'].includes(status)
        if (reachedState) {
            setPendingAction(null)
            return
        }
        const timeout = window.setTimeout(() => setPendingAction(null), 12000)
        return () => window.clearTimeout(timeout)
    }, [pendingAction, status])

    useEffect(() => {
        setHydrated(true)
    }, [])

    function handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.preventDefault()
        e.stopPropagation()
    }

    async function handleAction(action: 'start' | 'stop' | 'restart') {
        const feedbackKey = `vm-${vm.name}-${action}`
        if (!canManage) {
            onFeedback?.('This virtual machine is missing its instance name.', 'error', feedbackKey)
            return
        }
        setLoading(action)
        onFeedback?.(`${action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting'} ${vm.name}…`, 'progress', feedbackKey)
        try {
            const response = await manageVM(vm.name, action)
            if (response.ok) {
                if (action === 'start' || action === 'stop') setPendingAction(action)
                onFeedback?.(`${action === 'start' ? 'Start' : action === 'stop' ? 'Stop' : 'Restart'} requested for ${vm.name}.`, 'success', feedbackKey)
                router.refresh()
                onUpdated?.()
            } else {
                onFeedback?.(response.message, 'error', feedbackKey)
            }
        } catch {
            onFeedback?.(`Unable to ${action} ${vm.name}. Check its status before trying again.`, 'error', feedbackKey)
        } finally {
            setLoading(null)
        }
    }

    return (
        <div onClick={handleClick} className='flex min-w-0 flex-col items-end gap-2 rounded-md'>
            <div className='flex h-9 items-center justify-end gap-2'>
                {!isRunning && <button type='button' aria-label={`${loading === 'start' || pendingAction === 'start' || isStarting ? 'Starting' : 'Start'} ${vm.name}`} title={loading === 'start' || pendingAction === 'start' || isStarting ? 'Start requested' : 'Start VM'} onClick={() => void handleAction('start')} disabled={disabled} className={`${vmActionStyle} ${showLabels ? 'w-auto px-2.5' : 'w-9'} text-ui-success`}>
                    {loading === 'start' || pendingAction === 'start' || isStarting ? <LoaderCircle aria-hidden='true' className='h-4 w-4 animate-spin' /> : <Play aria-hidden='true' className='h-4 w-4' />}{showLabels && <span>Start</span>}
                </button>}
                {isRunning && <button type='button' aria-label={`${loading === 'restart' ? 'Restarting' : 'Restart'} ${vm.name}`} title='Restart VM' onClick={() => void handleAction('restart')} disabled={disabled} className={`${vmActionStyle} ${showLabels ? 'w-auto px-2.5' : 'w-9'} text-ui-primary`}>
                    {loading === 'restart' ? <LoaderCircle aria-hidden='true' className='h-4 w-4 animate-spin' /> : <RefreshCcw aria-hidden='true' className='h-4 w-4' />}{showLabels && <span>Restart</span>}
                </button>}
                {isRunning && <button type='button' aria-label={`${loading === 'stop' || pendingAction === 'stop' ? 'Stopping' : 'Stop'} ${vm.name}`} title='Stop VM' onClick={() => void handleAction('stop')} disabled={disabled} className={`${vmActionStyle} ${showLabels ? 'w-auto px-2.5' : 'w-9'} text-ui-text`}>
                    {loading === 'stop' || pendingAction === 'stop' ? <LoaderCircle aria-hidden='true' className='h-4 w-4 animate-spin' /> : <StopCircle aria-hidden='true' className='h-4 w-4' />}{showLabels && <span>Stop</span>}
                </button>}
            </div>
            <span className='sr-only' role='status' aria-live='polite'>{loading ? `${loading === 'start' ? 'Starting' : loading === 'stop' ? 'Stopping' : 'Restarting'} ${vm.name}` : isStarting ? `Starting ${vm.name}` : pendingAction ? `${pendingAction === 'start' ? 'Starting' : 'Stopping'} ${vm.name}` : ''}</span>
        </div>
    )
}
