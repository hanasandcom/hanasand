'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Copy, Plus, Save } from 'lucide-react'
import { ApiKeyScopeRows } from './ApiKeyScopeRows'
import { DateField, SelectField, TextField } from './RateLimitFields'
import { OwnerUserPicker } from './OwnerUserPicker'
import type { DraftApiKey, OwnerUserOption } from './model'

export function ApiKeyCreationForm({
    draft,
    setDraft,
    tierPreset,
    tierPresetIds,
    routeOptions,
    scopeValidation,
    ready,
    saving,
    message,
    issuedSecret,
    ownerUsers,
    ownerUsersLoading,
    ownerUsersError,
    reloadOwnerUsers,
    addScope,
    removeScope,
    applyTier,
    onCreate,
}: {
    draft: DraftApiKey
    setDraft: Dispatch<SetStateAction<DraftApiKey>>
    tierPreset: ApiKeyTierDefinition
    tierPresetIds: string[]
    routeOptions: string[]
    scopeValidation: { valid: boolean, message: string }
    ready: boolean
    saving: boolean
    message: string | null
    issuedSecret: string | null
    ownerUsers: OwnerUserOption[]
    ownerUsersLoading: boolean
    ownerUsersError: string | null
    reloadOwnerUsers: () => Promise<void>
    addScope: () => void
    removeScope: (scopeId: string) => void
    applyTier: (tier: string) => void
    onCreate: () => void
}) {
    return (
        <>
            <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>Create an API key</h2>
                    <p className='mt-1 text-sm text-ui-muted'>Choose who will use this key, give it a name, and add the routes it can access. For each route, set limits for second, minute, hour, and day windows.</p>
                </div>
                {message ? <div className='text-sm text-ui-warning'>{message}</div> : null}
            </div>
            <div className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='grid gap-3 md:grid-cols-2 md:items-end xl:grid-cols-4'>
                    <OwnerUserPicker label='Owner' value={draft.ownerId} users={ownerUsers} loading={ownerUsersLoading} error={ownerUsersError} onChange={(value) => setDraft((prev) => ({ ...prev, ownerId: value }))} onRefresh={reloadOwnerUsers} />
                    <TextField label='Key name' value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} />
                    <SelectField label='Tier' value={draft.tier} options={tierPresetIds} onChange={applyTier} />
                    <DateField label='Expires at' value={draft.expiresAt} onChange={(value) => setDraft((prev) => ({ ...prev, expiresAt: value }))} />
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
                    <TextField label='Description' value={draft.description} onChange={(value) => setDraft((prev) => ({ ...prev, description: value }))} />
                    <label className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                        <input type='checkbox' checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} className='h-4 w-4 accent-ui-primary' />Enabled
                    </label>
                </div>
                <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-ui-muted'>
                    <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 uppercase tracking-[0.18em] text-ui-muted'>Preset</span>
                    <span>{tierPreset.label}: {tierPreset.description}</span>
                    <span>New routes use these limits. Changing the tier updates every route you add here.</span>
                </div>
                <div className='mt-4 flex items-center justify-between gap-3'>
                    <h3 className='text-sm font-medium text-ui-text'>Allowed routes and limits</h3>
                    <button type='button' onClick={addScope} className='ui-button ui-button-ghost px-3 py-2 text-sm'><Plus className='h-4 w-4' />Add route</button>
                </div>
                <div className='mt-3 grid gap-3'>
                    {draft.scopes.length ? <ApiKeyScopeRows
                        scopes={draft.scopes}
                        routeOptions={routeOptions}
                        onChange={(next) => setDraft((prev) => ({ ...prev, scopes: prev.scopes.map((entry) => entry.id === next.id ? next : entry) }))}
                        onRemove={removeScope}
                    /> : (
                        <div className='rounded-lg border border-dashed border-ui-border bg-ui-raised px-4 py-5'>
                            <p className='text-sm font-medium text-ui-text'>No route added yet.</p>
                            <p className='mt-1 text-sm leading-6 text-ui-muted'>Add at least one allowed route before creating this key.</p>
                            <button type='button' onClick={addScope} className='mt-3 ui-button ui-button-ghost px-3 py-2 text-sm'><Plus className='h-4 w-4' />Add first route</button>
                        </div>
                    )}
                </div>
                {draft.scopes.length && !scopeValidation.valid ? <div className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>{scopeValidation.message}</div> : null}
                <div className='mt-4 flex flex-wrap items-center gap-3'>
                    <button type='button' onClick={onCreate} disabled={saving || !ready} className='inline-flex items-center gap-2 rounded-lg border border-ui-primary/30 bg-ui-primary/10 px-3 py-2 text-sm text-ui-primary transition-colors hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'><Save className='h-4 w-4' />{saving ? 'Creating...' : 'Create Key'}</button>
                    {issuedSecret ? <button type='button' onClick={() => navigator.clipboard.writeText(issuedSecret)} className='ui-button ui-button-ghost px-3 py-2 text-sm'><Copy className='h-4 w-4' />Copy `{issuedSecret}`</button> : null}
                </div>
            </div>
        </>
    )
}
