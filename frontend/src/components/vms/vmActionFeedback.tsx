'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, Info, LoaderCircle, X } from 'lucide-react'
import { createPortal } from 'react-dom'

export type VmFeedbackTone = 'progress' | 'success' | 'error' | 'info'
export type VmFeedback = { id: string, message: string, tone: VmFeedbackTone }
export type NotifyVmAction = (message: string, tone?: VmFeedbackTone, key?: string) => void

export function useVmActionFeedback() {
    const [items, setItems] = useState<VmFeedback[]>([])
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
    const sequence = useRef(0)

    const notify = useCallback<NotifyVmAction>((message, tone = 'success', key) => {
        const id = key || `vm-action-${++sequence.current}`
        const timeout = timers.current.get(id)
        if (timeout) clearTimeout(timeout)
        setItems(current => [...current.filter(item => item.id !== id), { id, message, tone }].slice(-3))
        timers.current.set(id, setTimeout(() => {
            setItems(current => current.filter(item => item.id !== id))
            timers.current.delete(id)
        }, message.length > 80 || message.includes('\n') ? 5000 : 3000))
    }, [])

    const dismiss = useCallback((id: string) => {
        const timeout = timers.current.get(id)
        if (timeout) clearTimeout(timeout)
        timers.current.delete(id)
        setItems(current => current.filter(item => item.id !== id))
    }, [])

    useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
    return { items, notify, dismiss }
}

export function VmActionFeedback({ items, dismiss }: { items: VmFeedback[], dismiss: (id: string) => void }) {
    if (!items.length || typeof document === 'undefined') return null
    return createPortal(<div aria-label='VM action updates' className='pointer-events-none fixed inset-x-3 top-[calc(var(--ui-header-height)+0.75rem)] z-[1300] flex max-h-[calc(100dvh-var(--ui-header-height)-1.5rem)] flex-col items-end gap-2 overflow-y-auto sm:inset-x-auto sm:right-5 sm:w-[min(24rem,calc(100vw-2.5rem))]'>
        {items.map(item => <div key={item.id} role={item.tone === 'error' ? 'alert' : 'status'} aria-live={item.tone === 'error' ? 'assertive' : 'polite'} className='pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-ui-border bg-ui-panel/95 px-4 py-3 text-sm text-ui-text shadow-xl shadow-black/20 backdrop-blur-xl'>
            <span className={`mt-0.5 shrink-0 ${item.tone === 'error' ? 'text-ui-danger' : item.tone === 'success' ? 'text-ui-success' : 'text-ui-primary'}`}>
                {item.tone === 'progress' ? <LoaderCircle className='h-4 w-4 animate-spin' aria-hidden='true' /> : item.tone === 'success' ? <Check className='h-4 w-4' aria-hidden='true' /> : item.tone === 'error' ? <CircleAlert className='h-4 w-4' aria-hidden='true' /> : <Info className='h-4 w-4' aria-hidden='true' />}
            </span>
            <p className='min-w-0 flex-1 leading-5'>{item.message}</p>
            {item.tone !== 'progress' && <button type='button' aria-label='Dismiss VM update' onClick={() => dismiss(item.id)} className='-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ui-muted transition hover:bg-ui-raised hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary'><X className='h-4 w-4' aria-hidden='true' /></button>}
        </div>)}
    </div>, document.body)
}
