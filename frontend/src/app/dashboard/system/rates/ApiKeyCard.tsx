'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { ApiKeyScopeEditor } from './ApiKeyScopeEditor'
import { DateField, EmptyState, SelectField, TextField } from './RateLimitFields'
import { OwnerUserPicker } from './OwnerUserPicker'
import { validateKeyFields, validateScopeSet, type OwnerUserOption } from './model'

export type ApiKeyCardProps = {
    apiKey: ApiKeySummary
    tierPresetMap: Record<string, ApiKeyTierDefinition>
    fallbackTierPresets: ApiKeyTierDefinition[]
    routeOptions: string[]
    tierPresetIds: string[]
    saving: boolean
    ownerUsers: OwnerUserOption[]
    ownerUsersLoading: boolean
    ownerUsersError: string | null
    reloadOwnerUsers: () => Promise<void>
    setApiKeys: Dispatch<SetStateAction<ApiKeySummary[]>>
    applyKeyTierPreset: (keyId: string, tier: string) => void
    updateKey: (apiKey: ApiKeySummary) => Promise<void>
    deleteKey: (idToDelete: string) => Promise<void>
    addScopeToKey: (keyId: string) => void
    removeKeyScope: (keyId: string, scopeId: string) => void
}

export function ApiKeyCard({
    apiKey,
    tierPresetMap,
    fallbackTierPresets,
    routeOptions,
    tierPresetIds,
    saving,
    ownerUsers,
    ownerUsersLoading,
    ownerUsersError,
    reloadOwnerUsers,
    setApiKeys,
    applyKeyTierPreset,
    updateKey,
    deleteKey,
    addScopeToKey,
    removeKeyScope,
}: ApiKeyCardProps) {
    const scopeValidation = useMemo(
        () => validateScopeSet(apiKey.scopes),
        [apiKey.scopes]
    )
    const fieldValidation = useMemo(
        () => validateKeyFields({
            ownerId: apiKey.ownerId || '',
            name: apiKey.name,
            tier: apiKey.tier,
            description: apiKey.description || '',
            expiresAt: apiKey.expiresAt || '',
        }),
        [apiKey.description, apiKey.expiresAt, apiKey.name, apiKey.ownerId, apiKey.tier]
    )
    const tierPreset = tierPresetMap[apiKey.tier] || tierPresetMap.custom || fallbackTierPresets[fallbackTierPresets.length - 1]

    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='text-base font-semibold text-ui-text'>{apiKey.name}</h3>
                        <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-ui-muted'>
                            {tierPreset.label}
                        </span>
                        <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-[11px] text-ui-muted'>{apiKey.keyPrefix}</span>
                    </div>
                    <p className='mt-2 text-sm text-ui-muted'>{apiKey.description || 'No description set.'}</p>
                    <div className='mt-2 flex flex-wrap gap-3 text-xs text-ui-muted'>
                        <span>{apiKey.ownerId ? <>Creator `{apiKey.ownerId}`</> : 'Organization-owned'}</span>
                        <span>Created {new Date(apiKey.createdAt).toLocaleString()}</span>
                        <span>Last used {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : 'never'}</span>
                    </div>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <label className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                        <input
                            type='checkbox'
                            checked={apiKey.enabled}
                            onChange={(event) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, enabled: event.target.checked } : entry))}
                            className='h-4 w-4 accent-ui-primary'
                        />
                        Enabled
                    </label>
                    <button
                        type='button'
                        onClick={() => updateKey(apiKey)}
                        disabled={saving || !fieldValidation.valid || !scopeValidation.valid}
                        className='inline-flex items-center gap-2 rounded-lg border border-ui-primary/30 bg-ui-primary/10 px-3 py-2 text-sm text-ui-primary transition-colors hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        <Save className='h-4 w-4' />
                        Save key
                    </button>
                    <button
                        type='button'
                        onClick={() => deleteKey(apiKey.id)}
                        className='inline-flex items-center gap-2 rounded-lg border border-ui-danger/30 bg-ui-raised/10 px-3 py-2 text-sm text-ui-text transition-colors hover:bg-ui-raised/15'
                    >
                        <Trash2 className='h-4 w-4' />
                        Delete
                    </button>
                </div>
            </div>

            <details className='mt-4 rounded-lg border border-ui-border bg-ui-panel'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text'>
                    <span>Key settings</span>
                    <span className='text-xs font-medium text-ui-muted'>{tierPreset.label} · {apiKey.expiresAt ? 'expires' : 'no expiry'}</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-4 md:grid-cols-2 xl:grid-cols-4'>
                    <TextField label='Name' value={apiKey.name} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, name: value } : entry))} />
                    <SelectField
                        label='Tier'
                        value={apiKey.tier}
                        options={tierPresetIds}
                        onChange={(value) => applyKeyTierPreset(apiKey.id, value)}
                    />
                    <OwnerUserPicker
                        label='Owner'
                        value={apiKey.ownerId || ''}
                        users={ownerUsers}
                        loading={ownerUsersLoading}
                        error={ownerUsersError}
                        onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, ownerId: value } : entry))}
                        onRefresh={reloadOwnerUsers}
                    />
                    <DateField label='Expires at' value={apiKey.expiresAt || ''} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, expiresAt: value || null } : entry))} />
                    <div className='md:col-span-2 xl:col-span-4'>
                        <TextField label='Description' value={apiKey.description || ''} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, description: value || null } : entry))} />
                    </div>
                    <p className='text-xs leading-5 text-ui-muted md:col-span-2 xl:col-span-4'>
                        {tierPreset.description}
                    </p>
                </div>
            </details>

            <details className='mt-3 rounded-lg border border-ui-border bg-ui-panel'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text'>
                    <span>Allowed routes</span>
                    <span className='text-xs font-medium text-ui-muted'>{apiKey.scopes.length} route{apiKey.scopes.length === 1 ? '' : 's'}</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-4'>
                    <div className='flex justify-end'>
                        <button
                            type='button'
                            onClick={() => addScopeToKey(apiKey.id)}
                            className='ui-button ui-button-ghost px-3 py-2 text-sm'
                        >
                            <Plus className='h-4 w-4' />
                            Add route
                        </button>
                    </div>
                    {apiKey.scopes.length ? apiKey.scopes.map((scope, index) => (
                        <ApiKeyScopeEditor
                            key={scope.id}
                            scope={scope}
                            routeOptions={routeOptions}
                            title={`Route ${index + 1}`}
                            onChange={(nextScope) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? {
                                ...entry,
                                scopes: entry.scopes.map((currentScope) => currentScope.id === nextScope.id ? nextScope : currentScope),
                            } : entry))}
                            onRemove={() => removeKeyScope(apiKey.id, scope.id)}
                        />
                    )) : (
                        <EmptyState message='Add a route to set its request limits.' />
                    )}
                </div>
            </details>
            {!fieldValidation.valid || !scopeValidation.valid ? (
                <div className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>
                    {fieldValidation.valid ? scopeValidation.message : fieldValidation.message}
                </div>
            ) : null}
        </div>
    )
}
