'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronDown, LoaderCircle, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { useConsoleViewport } from './useConsoleViewport'
import { useVmConsoleSession } from './useVmConsoleSession'
import VMAccessActions from './vmAccessActions'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import { useEffect, useId, useRef, useState } from 'react'

type VmConsoleProps = {
    name?: string
    host?: 'inspur' | 'ovh'
    onHostChange?: (host: 'inspur' | 'ovh') => void
    workspaceOrganizationId?: string
}

export default function VmConsole({ name, host, onHostChange, workspaceOrganizationId = '' }: VmConsoleProps) {
    const hostPicker = useRef<HTMLDivElement>(null)
    const hostTrigger = useRef<HTMLButtonElement>(null)
    const hostOptions = useRef<Array<HTMLButtonElement | null>>([])
    const hostListId = useId()
    const [hostMenuOpen, setHostMenuOpen] = useState(false)
    const { organizationId, loading, switching } = useWorkspace()
    const workspaceMatches = host !== undefined || (!switching && organizationId === workspaceOrganizationId)
    useEffect(() => {
        if (switching || (!loading && !workspaceMatches)) window.location.replace('/vms')
    }, [loading, switching, workspaceMatches])
    const consoleTarget = host === 'ovh' ? 'OVH' : host === 'inspur' ? 'Inspur' : name || 'Host'
    const session = useVmConsoleSession(name, host, workspaceMatches && !loading, workspaceOrganizationId)
    const viewport = useConsoleViewport(message => session.setStatus(message))
    const followBoot = session.boot.follow

    useEffect(() => {
        if (!hostMenuOpen) return
        const closeOutside = (event: PointerEvent) => {
            if (!hostPicker.current?.contains(event.target as Node)) setHostMenuOpen(false)
        }
        document.addEventListener('pointerdown', closeOutside)
        return () => document.removeEventListener('pointerdown', closeOutside)
    }, [hostMenuOpen])

    useEffect(() => {
        if (!hostMenuOpen || !host) return
        hostOptions.current[host === 'inspur' ? 0 : 1]?.focus()
    }, [hostMenuOpen, host])

    function moveHostFocus(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
        const next = event.key === 'ArrowDown' ? (index + 1) % 2
            : event.key === 'ArrowUp' ? (index - 1 + 2) % 2
                : event.key === 'Home' ? 0
                    : event.key === 'End' ? 1 : -1
        if (event.key === 'Escape') {
            setHostMenuOpen(false)
            hostTrigger.current?.focus()
        } else if (event.key === 'Tab') {
            setHostMenuOpen(false)
        } else if (next >= 0) {
            event.preventDefault()
            hostOptions.current[next]?.focus()
        }
    }

    if (name && !loading && !workspaceMatches) return <div role='status' className='p-6 text-sm text-ui-muted'>Returning to virtual machines…</div>

    return (
        <section
            ref={viewport.panel}
            data-expanded={viewport.expanded || undefined}
            style={viewport.expanded ? viewport.viewport : undefined}
            className={`flex min-h-0 flex-col gap-3 overflow-hidden border border-ui-border bg-ui-panel p-4 [&:fullscreen]:h-dvh [&:fullscreen]:w-screen [&:fullscreen]:rounded-none ${viewport.expanded
                ? 'fixed inset-0 z-[1000] h-dvh rounded-none pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]'
                : 'h-[calc(100dvh-7rem)] rounded-xl'}`}>
            <header className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <h1 className='text-lg font-semibold'>{consoleTarget} console</h1>
                    <p role='status' title={session.status} className='h-5 min-h-5 max-w-full truncate text-sm text-ui-muted'>
                        {session.status}{session.username ? ` · ${session.username}` : ''}
                    </p>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    {name && <VMAccessActions vmName={name} />}
                    {host && onHostChange && (
                        <div ref={hostPicker} className='relative'>
                            <button
                                ref={hostTrigger}
                                type='button'
                                role='combobox'
                                aria-label='Console host'
                                aria-haspopup='listbox'
                                aria-expanded={hostMenuOpen}
                                aria-controls={hostListId}
                                onClick={() => setHostMenuOpen(current => !current)}
                                onKeyDown={event => {
                                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                        event.preventDefault()
                                        setHostMenuOpen(true)
                                    } else if (event.key === 'Escape') setHostMenuOpen(false)
                                }}
                                className='flex h-9 min-w-24 items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel pl-3 pr-3 text-left text-sm text-ui-text outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/30 sm:h-10'>
                                <span>{host === 'inspur' ? 'Inspur' : 'OVH'}</span>
                                <ChevronDown aria-hidden='true' className={`h-4 w-4 shrink-0 text-ui-muted transition-transform ${hostMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {hostMenuOpen && <div id={hostListId} role='listbox' aria-label='Console host' className='absolute right-0 top-full z-40 mt-2 grid min-w-full gap-1 rounded-xl border border-ui-border bg-ui-panel p-1.5 shadow-2xl shadow-black/35 ring-1 ring-white/10'>
                                {(['inspur', 'ovh'] as const).map((option, index) => <button
                                    key={option}
                                    ref={element => { hostOptions.current[index] = element }}
                                    type='button'
                                    role='option'
                                    aria-selected={host === option}
                                    tabIndex={-1}
                                    onClick={() => { onHostChange(option); setHostMenuOpen(false); hostTrigger.current?.focus() }}
                                    onKeyDown={event => moveHostFocus(event, index)}
                                    className={`flex h-9 items-center justify-between gap-3 rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ui-primary ${host === option ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-text hover:bg-ui-raised'}`}>
                                    {option === 'inspur' ? 'Inspur' : 'OVH'}
                                    {host === option && <Check aria-hidden='true' className='h-4 w-4 shrink-0' />}
                                </button>)}
                            </div>}
                        </div>
                    )}
                    <button
                        type='button'
                        onClick={() => void viewport.toggleFullscreen()}
                        aria-label={viewport.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        title={viewport.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        aria-pressed={viewport.fullscreen}
                        className='rounded-lg border border-ui-border p-2'>
                        {viewport.fullscreen
                            ? <Minimize2 className='h-4 w-4' />
                            : <Maximize2 className='h-4 w-4' />}
                    </button>
                    <Link href={host ? '/system/hosts' : '/system'} aria-label='Back to overview' title='Back to overview' className='flex h-9 w-9 items-center justify-center rounded-lg border border-ui-border text-ui-primary transition hover:bg-ui-raised'>
                        <ArrowLeft aria-hidden='true' className='h-4 w-4' />
                    </Link>
                    <button
                        type='button'
                        onClick={() => session.reconnect.current()}
                        className='flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm'>
                        <RefreshCw className='h-4 w-4' />Reconnect
                    </button>
                </div>
            </header>
            {session.provisioning && (
                <div
                    role={session.provisioning.state === 'error' ? 'alert' : 'status'}
                    aria-live='polite'
                    className={`flex h-10 min-h-10 shrink-0 items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-sm ${session.provisioning.state === 'error'
                        ? 'border-ui-danger/25 bg-ui-danger/5 text-ui-danger'
                        : session.provisioning.state === 'ready'
                            ? 'border-ui-success/25 bg-ui-success/5 text-ui-success'
                            : 'border-ui-primary/20 bg-ui-primary/5 text-ui-text'}`}>
                    {session.provisioning.state === 'error'
                        ? <AlertCircle className='h-4 w-4 shrink-0' aria-hidden />
                        : session.provisioning.state === 'ready'
                            ? <CheckCircle2 className='h-4 w-4 shrink-0' aria-hidden />
                            : <LoaderCircle className='h-4 w-4 shrink-0 animate-spin text-ui-loader' aria-hidden />}
                    <span title={session.provisioning.message} className='min-w-0 truncate'>{session.provisioning.message}</span>
                </div>
            )}
            {(session.boot.output || session.boot.error || session.boot.expanded) && (
                <details
                    open={session.boot.expanded}
                    onToggle={event => session.boot.setExpanded(event.currentTarget.open)}
                    className='shrink-0 rounded-lg border border-ui-border px-3 py-2 text-sm'>
                    <summary className='cursor-pointer'>Restart log</summary>
                    {session.boot.error && <p className='text-ui-muted'>{session.boot.error}</p>}
                    <pre
                        ref={session.boot.panel}
                        onScroll={event => {
                            const el = event.currentTarget
                            followBoot.current = el.scrollHeight - el.scrollTop - el.clientHeight < 4
                        }}
                        className='mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs'
                        aria-label='VM restart log'>
                        {session.boot.output || 'Waiting for boot output…'}
                    </pre>
                </details>
            )}
            {session.opening && (
                <div role='status' className='flex items-center gap-3 rounded-lg border border-ui-primary/25 bg-ui-primary/5 px-4 py-3 text-sm text-ui-primary'>
                    <LoaderCircle className='h-5 w-5 animate-spin text-ui-loader' aria-hidden />
                    {session.status}
                </div>
            )}
            <div
                ref={session.container}
                aria-label={consoleTarget + ' terminal'}
                className='min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-ui-border bg-ui-canvas p-2'
            />
        </section>
    )
}
