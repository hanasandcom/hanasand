'use client'

import type { Dispatch, SetStateAction } from 'react'
import { ApiKeyCard } from './ApiKeyCard'
import { EmptyState } from './RateLimitFields'
import type { OwnerUserOption } from './model'

export function ApiKeyList({
    apiKeys,
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
}: {
    apiKeys: ApiKeySummary[]
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
}) {
    return (
        <div className='mt-4 grid gap-4'>
                {apiKeys.length ? apiKeys.map((apiKey) => (
                    <ApiKeyCard
                        key={apiKey.id}
                        apiKey={apiKey}
                        tierPresetMap={tierPresetMap}
                        fallbackTierPresets={fallbackTierPresets}
                        routeOptions={routeOptions}
                        tierPresetIds={tierPresetIds}
                        saving={saving}
                        ownerUsers={ownerUsers}
                        ownerUsersLoading={ownerUsersLoading}
                        ownerUsersError={ownerUsersError}
                        reloadOwnerUsers={reloadOwnerUsers}
                        setApiKeys={setApiKeys}
                        applyKeyTierPreset={applyKeyTierPreset}
                        updateKey={updateKey}
                        deleteKey={deleteKey}
                        addScopeToKey={addScopeToKey}
                        removeKeyScope={removeKeyScope}
                    />
                )) : <EmptyState message='No access keys issued yet.' />}
        </div>
    )
}
