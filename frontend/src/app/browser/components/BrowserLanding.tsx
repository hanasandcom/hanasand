'use client'

import Link from 'next/link'
import { Globe2, Play, SlidersHorizontal, Plus } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { BrowserQuota, BrowserRunHistory, BrowserRunStats, SandboxCapacity, SandboxProfile } from '../types'
import { browserFingerprints } from '../browserSetup'
import { isDefaultProfile, profileSyncLabel } from '../browserProfiles'
import BrowserHistory from '../BrowserHistory'
import { HistoryPanel } from './RunHistoryPanel'
import { ProfilePicker, ProfileToolEditor } from './ProfileControls'

type BrowserLandingProps = {
    formReady: boolean; target: string; setTarget: Dispatch<SetStateAction<string>>; normalizedTarget: string; startRun: () => void
    capacity: SandboxCapacity | null; runStats: BrowserRunStats | null; customUserAgent: string; customViewportWidth: string; customViewportHeight: string
    customLocale: string; customTimezoneId: string; customPlatform: string; activeUserAgentLabel: string
    setCustomUserAgent: Dispatch<SetStateAction<string>>; setCustomViewportWidth: Dispatch<SetStateAction<string>>; setCustomViewportHeight: Dispatch<SetStateAction<string>>
    setCustomLocale: Dispatch<SetStateAction<string>>; setCustomTimezoneId: Dispatch<SetStateAction<string>>; setCustomPlatform: Dispatch<SetStateAction<string>>
    applyFingerprint: (id: string) => void; paidBrowserPlan: boolean; profiles: SandboxProfile[]; selectedProfile: SandboxProfile; setSelectedProfileId: Dispatch<SetStateAction<string>>
    deleteProfile: (id: string) => void; profileSyncState: 'local' | 'loading' | 'synced' | 'saving' | 'error'; customProfileName: string; setCustomProfileName: Dispatch<SetStateAction<string>>; saveProfile: () => void
    customToolName: string; customToolUrl: string; setCustomToolName: Dispatch<SetStateAction<string>>; setCustomToolUrl: Dispatch<SetStateAction<string>>
    addToolToSelectedProfile: () => void; removeToolFromSelectedProfile: (id: string) => void; history: BrowserRunHistory[]; quota: BrowserQuota | null
    historyReady: boolean; deleteHistory: (ids?: string[]) => Promise<void>; shareFinding: (run: BrowserRunHistory) => Promise<string>; resultClientId: string
}

export function BrowserLanding(props: BrowserLandingProps) {
    const { formReady, target, setTarget, normalizedTarget, startRun, capacity, runStats, customUserAgent, customViewportWidth, customViewportHeight, customLocale, customTimezoneId, customPlatform, activeUserAgentLabel, setCustomUserAgent, setCustomViewportWidth, setCustomViewportHeight, setCustomLocale, setCustomTimezoneId, setCustomPlatform, applyFingerprint, paidBrowserPlan, profiles, selectedProfile, setSelectedProfileId, deleteProfile, profileSyncState, customProfileName, setCustomProfileName, saveProfile, customToolName, customToolUrl, setCustomToolName, setCustomToolUrl, addToolToSelectedProfile, removeToolFromSelectedProfile, history, quota, historyReady, deleteHistory, shareFinding, resultClientId } = props
    return (
        <main data-browser-landing className='flex h-full min-h-0 flex-col overflow-hidden bg-ui-canvas text-ui-text'>
            <section className='mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)] lg:grid-rows-1 lg:items-center lg:gap-8'>
                <div className='grid gap-4'>
                    <h1 className='max-w-xl text-4xl font-semibold tracking-normal text-ui-text md:text-6xl'>Sandbox</h1>
                    <p className='max-w-xl text-base leading-7 text-ui-muted'>
                        Investigate domains quickly. Onion addresses are also supported.
                    </p>
                    <div className='grid max-w-xl gap-2 text-sm text-ui-muted sm:grid-cols-3'>
                        <span className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'><strong className='text-ui-text'>{capacity?.activeSessions ?? 0}/{capacity?.maxSessions ?? 100}</strong> browsers active</span>
                        <span className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>{runStats?.runs24h ?? '—'} runs today</span>
                        <span className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>{runStats?.darkwebRuns24h ?? '—'} darkweb runs today</span>
                    </div>
                </div>
                <div className='grid max-h-full min-h-0 min-w-0 gap-3 overflow-y-auto'>
                    <form
                        className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'
                        onSubmit={(event) => {
                            event.preventDefault()
                            startRun()
                        }}
                    >
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold text-ui-text'>Investigate</h2>
                            </div>
                            <Globe2 className='h-5 w-5 shrink-0 text-ui-primary' />
                        </div>
                        <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]'>
                            <input
                                id='sandbox-url'
                                value={target}
                                onChange={event => setTarget(event.target.value)}
                                placeholder='URL to investigate'
                                disabled={!formReady}
                                className='col-span-2 h-12 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 font-mono text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 md:col-span-1'
                            />
                            <button type='submit' disabled={!formReady || !normalizedTarget} className='inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'>
                                <Play className='h-4 w-4' />
                                Start
                            </button>
                            <details className='relative'>
                                <summary className='grid h-12 w-12 cursor-pointer list-none place-items-center rounded-md border border-ui-border bg-ui-raised text-ui-text transition hover:border-ui-primary [&::-webkit-details-marker]:hidden' aria-label='Browser metadata'>
                                    <SlidersHorizontal className='h-4 w-4' />
                                </summary>
                                <div className='absolute right-0 z-20 mt-2 grid w-[min(34rem,calc(100vw-2rem))] gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 shadow-xl'>
                                    <div className='flex flex-wrap gap-2'>
                                        {browserFingerprints.map(item => (
                                            <button key={item.id} type='button' onClick={() => applyFingerprint(item.id)} className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${customUserAgent.trim() === item.userAgent ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'}`}>
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className='grid gap-2 sm:grid-cols-2'>
                                        <label className='flex h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm focus-within:border-ui-primary'>
                                            <span className='shrink-0 text-xs font-semibold uppercase text-ui-muted'>Width</span>
                                            <input value={customViewportWidth} onChange={event => setCustomViewportWidth(event.target.value)} inputMode='numeric' aria-label='Viewport width' className='min-w-0 flex-1 bg-transparent text-ui-text outline-none' />
                                        </label>
                                        <label className='flex h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm focus-within:border-ui-primary'>
                                            <span className='shrink-0 text-xs font-semibold uppercase text-ui-muted'>Height</span>
                                            <input value={customViewportHeight} onChange={event => setCustomViewportHeight(event.target.value)} inputMode='numeric' aria-label='Viewport height' className='min-w-0 flex-1 bg-transparent text-ui-text outline-none' />
                                        </label>
                                        <label className='flex h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm focus-within:border-ui-primary'>
                                            <span className='shrink-0 text-xs font-semibold uppercase text-ui-muted'>Locale</span>
                                            <input value={customLocale} onChange={event => setCustomLocale(event.target.value)} aria-label='Locale' className='min-w-0 flex-1 bg-transparent text-ui-text outline-none' />
                                        </label>
                                        <label className='flex h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm focus-within:border-ui-primary'>
                                            <span className='shrink-0 text-xs font-semibold uppercase text-ui-muted'>Timezone</span>
                                            <input value={customTimezoneId} onChange={event => setCustomTimezoneId(event.target.value)} aria-label='Timezone' className='min-w-0 flex-1 bg-transparent text-ui-text outline-none' />
                                        </label>
                                    </div>
                                    <label className='flex h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm focus-within:border-ui-primary'>
                                        <span className='shrink-0 text-xs font-semibold uppercase text-ui-muted'>Platform</span>
                                        <input value={customPlatform} onChange={event => setCustomPlatform(event.target.value)} aria-label='Platform' className='min-w-0 flex-1 bg-transparent text-ui-text outline-none' />
                                    </label>
                                    <label className='grid gap-1 rounded-md border border-ui-border bg-ui-canvas px-3 py-2 focus-within:border-ui-primary'>
                                        <span className='flex items-center justify-between gap-2 text-xs font-semibold uppercase text-ui-muted'><span>User agent</span><span className='normal-case font-medium text-ui-primary'>{activeUserAgentLabel}</span></span>
                                        <textarea value={customUserAgent} onChange={event => setCustomUserAgent(event.target.value)} aria-label='User agent' rows={3} className='min-h-16 resize-y bg-transparent font-mono text-xs text-ui-text outline-none' />
                                    </label>
                                </div>
                            </details>
                        </div>
                        <details className='grid gap-3'>
                            <summary className='flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden'>
                                <ProfilePicker paid={paidBrowserPlan} profiles={profiles} selectedProfileId={selectedProfile.id} onSelect={setSelectedProfileId} onDelete={deleteProfile} />
                                {paidBrowserPlan ? <span className='ml-auto shrink-0 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-primary'>Edit</span> : null}
                            </summary>
                            <div className='grid gap-3'>
                                {!paidBrowserPlan ? <Link href='/pricing#browser' className='text-sm font-semibold text-ui-primary'>Upgrade for automated analysis profiles</Link> : null}
                                <p className='text-sm text-ui-muted'>Profiles run the selected URL through external triage surfaces in the remote sandbox context.</p>
                                <p className='text-xs text-ui-muted'>{profileSyncLabel(profileSyncState)}</p>
                                <div className='flex gap-2'>
                                    <input value={customProfileName} onChange={event => setCustomProfileName(event.target.value)} placeholder='Profile name' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none' />
                                    <button type='button' onClick={saveProfile} className='grid h-9 w-9 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary' aria-label='Save profile'>
                                        <Plus className='h-4 w-4' />
                                    </button>
                                </div>
                                <ProfileToolEditor
                                    profile={selectedProfile}
                                    locked={!paidBrowserPlan || isDefaultProfile(selectedProfile.id)}
                                    toolName={customToolName}
                                    toolUrl={customToolUrl}
                                    onToolName={setCustomToolName}
                                    onToolUrl={setCustomToolUrl}
                                    onAddTool={addToolToSelectedProfile}
                                    onRemoveTool={removeToolFromSelectedProfile}
                                />
                            </div>
                        </details>
                        <HistoryPanel history={history} quota={quota} embedded historyReady={historyReady} onDelete={deleteHistory} onShare={shareFinding} />
                    </form>
                </div>
            </section>
            <div className='mx-auto flex w-full max-w-7xl shrink-0 justify-end px-4 pb-4'><BrowserHistory clientId={resultClientId} onShare={shareFinding} /></div>
        </main>
    )
}
