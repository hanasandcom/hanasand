'use client'

import Image from 'next/image'
import { Check, Globe2, LoaderCircle } from 'lucide-react'
import type { Capture, SandboxTool, SessionState } from '../types'
import SiteNetworkDetails, { type SiteNetwork } from '../SiteNetworkDetails'
import { formatRunDuration } from '../browserRunData'
import { providerDetail, providerStatus, providerTabStatus, selectToolCapture } from '../browserProviderData'
import { historyDomainKey } from '../historyData'

export function BrowserLoading({ stage, elapsed, target, queuePosition, onCancel }: { stage: number; elapsed: number; target: string; queuePosition?: number; onCancel: () => void }) {
    const steps = ['Connect', 'Start browser', 'Load page', 'First frame']
    const labels = ['Connecting…', 'Starting browser…', 'Loading page…', 'Preparing your view…']
    return <div className='flex min-h-[65vh] items-center justify-center p-5' data-browser-loading>
        <section className='w-full max-w-xl overflow-hidden rounded-2xl border border-ui-border bg-ui-panel shadow-ui-soft' aria-label='Browser startup'>
            <div className='relative border-b border-ui-border bg-ui-primary/5 px-6 pb-7 pt-8 sm:px-8'>
                <div className='mb-6 flex items-center justify-between'>
                    <div className='relative grid size-14 place-items-center rounded-2xl border border-ui-primary/20 bg-ui-primary/10 text-ui-primary'>
                        <Globe2 className='size-7' aria-hidden='true' />
                        <span className='absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-ui-panel bg-ui-primary motion-safe:animate-pulse' />
                    </div>
                    <span className='font-mono text-xs tabular-nums text-ui-muted' aria-label='Elapsed time'>{formatRunDuration(elapsed)}</span>
                </div>
                <div className='flex items-center gap-3' role='status' aria-live='polite'>
                    <LoaderCircle className='size-5 shrink-0 text-ui-loader motion-safe:animate-spin' aria-hidden='true' />
                    <h1 className='text-xl font-semibold tracking-tight'>{queuePosition ? `Waiting for a browser · #${queuePosition}` : labels[stage]}</h1>
                </div>
                <p className='mt-3 truncate font-mono text-xs text-ui-muted' title={target}>{target}</p>
            </div>
            <div className='px-6 py-6 sm:px-8'>
                <ol className='grid grid-cols-4 gap-2' aria-label='Startup progress'>
                    {steps.map((label, index) => <li key={label} aria-current={index === stage ? 'step' : undefined} className={index <= stage ? 'text-ui-primary' : 'text-ui-muted'}>
                        <div className={`mb-3 h-1.5 rounded-full ${index < stage ? 'bg-ui-primary' : index === stage ? 'bg-ui-primary/40 motion-safe:animate-pulse' : 'bg-ui-border'}`} />
                        <span className='flex items-center gap-1 text-[11px] font-medium sm:text-xs'>{index < stage ? <Check className='size-3 shrink-0' aria-hidden='true' /> : null}{label}</span>
                    </li>)}
                </ol>
                <div className='mt-7 flex items-center justify-between gap-4'>
                    <span className='text-xs text-ui-muted'>{elapsed >= 20 ? 'Taking longer than usual. You can cancel and retry.' : 'Opening an isolated session'}</span>
                    <button type='button' onClick={onCancel} className='rounded-lg border border-ui-border px-4 py-2 text-sm font-medium transition hover:border-ui-primary hover:text-ui-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'>Cancel</button>
                </div>
            </div>
        </section>
    </div>
}

export function SandboxTabStrip({
    domainUrl,
    siteNetwork,
    activeTab,
    sessionState,
    tools,
    toolCaptures,
    target,
    onSelect,
}: {
    domainUrl: string
    siteNetwork?: SiteNetwork
    activeTab: string
    sessionState: SessionState
    tools: SandboxTool[]
    toolCaptures: Capture[]
    target: string
    onSelect: (tab: string) => void
}) {
    return (
        <div role='tablist' aria-label='Browser and analysis tools' className='flex max-w-full flex-wrap items-center gap-2' onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'))
            const current = tabs.indexOf(event.target as HTMLButtonElement)
            if (current < 0) return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
            tabs[next]?.focus()
            tabs[next]?.click()
        }}>
            <h1 className='text-lg font-semibold'><SandboxTabButton
                active={activeTab === 'browser'}
                label={historyDomainKey(domainUrl)}
                status=''
                onClick={() => onSelect('browser')}
            /></h1>
            <SiteNetworkDetails site={siteNetwork} />
            {tools.map(tool => {
                const capture = selectToolCapture(toolCaptures, tool, target)
                const status = providerTabStatus(capture, capture?.toolAnalysis)
                const ended = ['ended', 'failed', 'unreachable'].includes(sessionState)
                if (tool.id === 'webcrack' && !capture?.deobfuscatedCode && !capture?.webcrackLoad?.loaded && !capture?.webcrackLoad?.sampleBytes) return null
                return (
                    <SandboxTabButton
                        key={tool.id}
                        active={activeTab === tool.id}
                        label={tool.name}
                        provider={tool.id}
                        status={ended && ['loading', 'waiting'].includes(status) ? 'incomplete' : status.replace(/ vendors$| alerts$/, '')}
                        onClick={() => onSelect(tool.id)}
                    />
                )
            })}
        </div>
    )
}

export function SandboxTabButton({ active, label, status, provider, onClick }: { active: boolean; label: string; status: string; provider?: string; onClick: () => void }) {
    return (
        <button
            type='button'
            onClick={onClick}
            role='tab'
            disabled={status === 'no obfuscated code'}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            aria-label={`${label}${status ? ` ${status}` : ''}`}
            title={label}
            className={`flex shrink-0 items-center gap-1 text-left text-xs transition ${active ? 'text-ui-primary' : 'text-ui-text hover:text-ui-primary'}`}
        >
            {provider ? <span aria-hidden='true' className='text-ui-muted'>·</span> : null}
            {provider && ['virustotal', 'urlquery', 'webcrack'].includes(provider) ? <Image src={`/logos/${provider}.${provider === 'virustotal' ? 'svg' : 'png'}`} alt={label} width={20} height={20} unoptimized className='h-4 w-4 shrink-0 object-contain' /> : null}
            <span className={`${provider && ['virustotal', 'urlquery', 'webcrack'].includes(provider) ? 'sr-only' : ''} truncate text-[11px] font-semibold sm:text-xs md:text-sm`}>{label}</span>
            {status ? <span className='truncate text-[11px] text-ui-muted'>{status}</span> : null}
        </button>
    )
}

export function ProviderStatusPanel({ tools, toolCaptures, target, onSelect }: { tools: SandboxTool[]; toolCaptures: Capture[]; target: string; onSelect: (tab: string) => void }) {
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <h2 className='text-sm font-semibold uppercase text-ui-primary'>Tabs</h2>
            <div className='mt-3 grid gap-2'>
                {tools.length ? tools.map(tool => {
                    const capture = selectToolCapture(toolCaptures, tool, target)
                    const analysis = capture?.toolAnalysis
                    return (
                        <button
                            key={tool.id}
                            type='button'
                            onClick={() => onSelect(tool.id)}
                            className='grid gap-1 rounded-md border border-ui-border bg-ui-raised p-3 text-left transition hover:border-ui-primary'
                        >
                            <span className='flex items-center justify-between gap-2'>
                                <span className='font-semibold text-ui-text'>{tool.name}</span>
                                <span className='rounded border border-ui-border bg-ui-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ui-muted'>{providerStatus(capture, analysis)}</span>
                            </span>
                            <span className='text-xs leading-5 text-ui-muted'>{providerDetail(analysis, capture)}</span>
                        </button>
                    )
                }) : <p className='text-xs text-ui-muted'>No provider tools configured for this profile.</p>}
            </div>
        </section>
    )
}

export function compactBrowserEvent(event: string) {
    const text = event.replace(/^(?:WebRTC browser|Sandbox|Browser)\s+/i, '').replace(/^run\s+/i, '').replace(/\.$/, '')
    return text.replace(/^./, letter => letter.toUpperCase())
}
