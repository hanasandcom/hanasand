'use client'

import { useMemo, useState } from 'react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { ApiKeyCreationForm } from './ApiKeyCreationForm'
import { ApiKeyList } from './ApiKeyList'
import { RateLimitHeader } from './RateLimitHeader'
import { RateLimitPolicyWorkspace } from './RateLimitPolicyWorkspace'
import { useApiKeyCollection } from './useApiKeyCollection'
import { useApiKeyDraft } from './useApiKeyDraft'
import { useApiKeyScopes } from './useApiKeyScopes'
import { useOwnerUsers } from './useOwnerUsers'
import { useRateLimitPolicy } from './useRateLimitPolicy'
import { emptyDraft, fallbackTierPresets } from './model'

export default function RateLimitsPageClient({
    initialSettings,
    routes,
    tierPresets,
    initialApiKeys,
}: {
    initialSettings: RateLimitSettings | null
    routes: RateLimitRoute[]
    tierPresets: ApiKeyTierDefinition[]
    initialApiKeys: ApiKeySummary[]
}) {
    const [saving, setSaving] = useState(false)
    const [workspace, setWorkspace] = useState<'keys' | 'policy'>('keys')
    const activeTierPresets = tierPresets.length ? tierPresets : fallbackTierPresets
    const tierPresetIds = activeTierPresets.map((preset) => preset.id)
    const tierPresetMap = useMemo(
        () => Object.fromEntries(activeTierPresets.map((preset) => [preset.id, preset])),
        [activeTierPresets]
    )
    const policy = useRateLimitPolicy(initialSettings, routes, setSaving)
    const draftState = useApiKeyDraft(routes, tierPresetMap)
    const keyState = useApiKeyCollection(initialApiKeys, setSaving)
    const ownerState = useOwnerUsers()
    const keyScopes = useApiKeyScopes(routes, tierPresetMap, keyState.setApiKeys)
    const draftTierPreset = tierPresetMap[draftState.draft.tier] || tierPresetMap.custom || fallbackTierPresets[fallbackTierPresets.length - 1]
    const draftHasChanges = Boolean(
        draftState.draft.ownerId || draftState.draft.name || draftState.draft.description ||
        draftState.draft.expiresAt || draftState.draft.scopes.length
    )

    function createKey() {
        void keyState.createKey(
            draftState.draft,
            draftState.requiredValidation.valid,
            draftState.requiredValidation.message,
            draftState.scopeValidation.valid,
            draftState.scopeValidation.message,
            () => draftState.setDraft(emptyDraft)
        )
    }

    return (
        <div className='grid gap-4'>
            <RateLimitHeader
                workspace={workspace}
                setWorkspace={setWorkspace}
                routeCount={routes.length}
                overrideCount={policy.overrideCount}
                keyCount={keyState.apiKeys.length}
                settings={policy.settings}
                saving={saving}
                overrideValid={policy.overrideValidation.valid}
                draftHasChanges={draftHasChanges}
                draftReady={draftState.ready}
                draftReadiness={draftState.readiness}
                message={policy.message}
                saveSettings={() => void policy.saveSettings()}
                onChangeEnabled={(enabled) => policy.setSettings((prev) => ({ ...prev, enabled }))}
            />

            {workspace === 'policy' ? (
                <RateLimitPolicyWorkspace
                    settings={policy.settings}
                    routeOptions={policy.routeOptions}
                    validation={policy.overrideValidation}
                    updateDefault={policy.updateDefault}
                    updateOverride={policy.updateOverride}
                    addOverride={policy.addOverride}
                    removeOverride={policy.removeOverride}
                />
            ) : null}

            {workspace === 'keys' ? (
                <DashboardPanel className='p-4 sm:p-5'>
                    <ApiKeyCreationForm
                        draft={draftState.draft}
                        setDraft={draftState.setDraft}
                        tierPreset={draftTierPreset}
                        tierPresetIds={tierPresetIds}
                        routeOptions={policy.routeOptions}
                        scopeValidation={draftState.scopeValidation}
                        ready={draftState.ready}
                        saving={saving}
                        message={keyState.message}
                        issuedSecret={keyState.issuedSecret}
                        ownerUsers={ownerState.users}
                        ownerUsersLoading={ownerState.loading}
                        ownerUsersError={ownerState.error}
                        reloadOwnerUsers={ownerState.reload}
                        addScope={draftState.addScope}
                        removeScope={draftState.removeScope}
                        applyTier={draftState.applyTier}
                        onCreate={createKey}
                    />
                    <ApiKeyList
                        apiKeys={keyState.apiKeys}
                        tierPresetMap={tierPresetMap}
                        fallbackTierPresets={fallbackTierPresets}
                        routeOptions={policy.routeOptions}
                        tierPresetIds={tierPresetIds}
                        saving={saving}
                        ownerUsers={ownerState.users}
                        ownerUsersLoading={ownerState.loading}
                        ownerUsersError={ownerState.error}
                        reloadOwnerUsers={ownerState.reload}
                        setApiKeys={keyState.setApiKeys}
                        applyKeyTierPreset={keyScopes.applyTier}
                        updateKey={keyState.updateKey}
                        deleteKey={keyState.deleteKey}
                        addScopeToKey={keyScopes.addToKey}
                        removeKeyScope={keyScopes.removeFromKey}
                    />
                </DashboardPanel>
            ) : null}

            <datalist id='rate-limit-routes'>
                {policy.routeOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
        </div>
    )
}
