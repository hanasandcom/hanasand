'use client'

import { Save } from 'lucide-react'
import { DashboardPanel } from 'hanasand/dashboard'
import { StatChip } from './RateLimitFields'

export function RateLimitHeader({
    workspace,
    setWorkspace,
    routeCount,
    overrideCount,
    keyCount,
    settings,
    saving,
    overrideValid,
    draftHasChanges,
    draftReady,
    draftReadiness,
    message,
    saveSettings,
    onChangeEnabled,
}: {
    workspace: 'keys' | 'policy'
    setWorkspace: (workspace: 'keys' | 'policy') => void
    routeCount: number
    overrideCount: number
    keyCount: number
    settings: RateLimitSettings
    saving: boolean
    overrideValid: boolean
    draftHasChanges: boolean
    draftReady: boolean
    draftReadiness: string
    message: string | null
    saveSettings: () => void
    onChangeEnabled: (enabled: boolean) => void
}) {
    return (
        <DashboardPanel className='p-4 sm:p-5'>
            <div className='grid gap-4 2xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:items-start'>
                <div className='max-w-3xl'><h1 className='text-xl font-semibold text-ui-text'>Rate Limits</h1></div>
                <div className='grid gap-2 sm:grid-cols-3'>
                    <StatChip label='Routes' value={String(routeCount)} />
                    <StatChip label='Overrides' value={String(overrideCount)} />
                    <StatChip label='Keys' value={String(keyCount)} />
                </div>
            </div>
            <div className='mt-4 flex flex-wrap items-center gap-2'>
                <div className='inline-flex rounded-lg border border-ui-border bg-ui-raised p-1' role='group' aria-label='Rate-limit workspace'>
                    {([['keys', 'Keys'], ['policy', 'Policy']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            type='button'
                            onClick={() => setWorkspace(key)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${workspace === key ? 'bg-ui-primary/15 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
                        >{label}</button>
                    ))}
                </div>
                {workspace === 'policy' ? (
                    <>
                        <label className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                            <input type='checkbox' checked={settings.enabled} onChange={(event) => onChangeEnabled(event.target.checked)} className='h-4 w-4 accent-ui-primary' />
                            Enabled
                        </label>
                        <div className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs text-ui-muted'>Changes apply to new requests immediately.</div>
                        <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
                            <label className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                                <span className='text-xs text-ui-muted'>Updated</span>
                                <span>{settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'never'}</span>
                            </label>
                            <button type='button' onClick={saveSettings} disabled={saving || !overrideValid} className='inline-flex items-center gap-2 rounded-lg border border-ui-primary/30 bg-ui-primary/10 px-3 py-2 text-sm text-ui-primary transition-colors hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'>
                                <Save className='h-4 w-4' />{saving ? 'Saving...' : 'Save policy'}
                            </button>
                        </div>
                    </>
                ) : draftHasChanges ? (
                    <div className={`rounded-lg border px-3 py-2 text-sm sm:ml-auto ${draftReady ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'}`}>
                        {draftReadiness}
                    </div>
                ) : null}
            </div>
            <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-ui-muted'>
                {settings.updatedBy ? <span>saved by `{settings.updatedBy}`</span> : null}
                {message ? <span className='text-ui-warning'>{message}</span> : null}
            </div>
        </DashboardPanel>
    )
}
