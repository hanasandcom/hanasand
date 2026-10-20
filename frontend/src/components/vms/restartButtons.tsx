'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import manageVM from '@/utils/vms/fetch/manage/manage'
import { Play, RefreshCcw, StopCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ErrorNotice from '../error/errorNotice'
import { vmActionStyle } from './actionStyle'

export default function RestartButtons({ vm, onUpdated, showLabels = false }: { vm: VM, onUpdated?: () => void, showLabels?: boolean }) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const [loading, setLoading] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const status = (vm.status || '').toLowerCase()
    const isRunning = status === 'running' || status === 'frozen'
    const canManage = Boolean(vm.name)
    const disabled = loading || !hydrated || Boolean(vm.deleted_at)

    useEffect(() => {
        setHydrated(true)
    }, [])

    function handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.preventDefault()
        e.stopPropagation()
    }

    async function handleAction(action: 'start' | 'stop' | 'restart') {
        if (!canManage) {
            setMessage('This virtual machine is missing its instance name.')
            return
        }
        setLoading(true)
        try {
            const response = await manageVM(vm.name, action)
            setMessage(response)
            if (response && !response.toLowerCase().includes('failed') && !response.toLowerCase().includes('error')) {
                router.refresh()
                onUpdated?.()
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div onClick={handleClick} className='flex min-w-0 flex-col items-end gap-2 rounded-md'>
            <div className='flex h-9 items-center justify-end gap-2'>
                {!isRunning && <button type='button' aria-label={`Start ${vm.name}`} title='Start VM' onClick={() => void handleAction('start')} disabled={disabled} className={`${vmActionStyle} ${showLabels ? 'w-auto px-2.5' : 'w-9'} text-ui-success`}>
                    <Play className='w-4 h-4' />{showLabels && <span>Start</span>}
                </button>}
                {isRunning && <button type='button' aria-label={`Restart ${vm.name}`} title='Restart VM' onClick={() => void handleAction('restart')} disabled={disabled} className={`${vmActionStyle} ${showLabels ? 'w-auto px-2.5' : 'w-9'} text-ui-primary`}>
                    <RefreshCcw className='w-4 h-4' />{showLabels && <span>Restart</span>}
                </button>}
                {isRunning && <button type='button' aria-label={`Stop ${vm.name}`} title='Stop VM' onClick={() => void handleAction('stop')} disabled={disabled} className={`${vmActionStyle} ${showLabels ? 'w-auto px-2.5' : 'w-9'} text-ui-text`}>
                    <StopCircle className='w-4 h-4' />{showLabels && <span>Stop</span>}
                </button>}
            </div>
            <ErrorNotice compact variant='info' className='max-w-sm text-left' message={message as string | null} />
        </div>
    )
}
