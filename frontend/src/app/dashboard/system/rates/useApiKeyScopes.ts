'use client'

import type { Dispatch, SetStateAction } from 'react'
import { createPresetLimits } from './model'

export function useApiKeyScopes(
    routes: RateLimitRoute[],
    tierPresetMap: Record<string, ApiKeyTierDefinition>,
    setApiKeys: Dispatch<SetStateAction<ApiKeySummary[]>>
) {
    function addToKey(keyId: string) {
        const firstRoute = routes[0]
        setApiKeys((previous) => previous.map((entry) => entry.id === keyId ? {
            ...entry,
            scopes: [...entry.scopes, {
                id: crypto.randomUUID(),
                enabled: true,
                method: firstRoute?.method || 'GET',
                route: firstRoute?.route || '/api/',
                limits: createPresetLimits(entry.tier, tierPresetMap),
            }],
        } : entry))
    }

    function removeFromKey(keyId: string, scopeId: string) {
        setApiKeys((previous) => previous.map((entry) => entry.id === keyId ? {
            ...entry,
            scopes: entry.scopes.filter((scope) => scope.id !== scopeId),
        } : entry))
    }

    function applyTier(keyId: string, tier: string) {
        setApiKeys((previous) => previous.map((entry) => entry.id === keyId ? {
            ...entry,
            tier,
            scopes: entry.scopes.map((scope) => ({ ...scope, limits: createPresetLimits(tier, tierPresetMap) })),
        } : entry))
    }

    return { addToKey, removeFromKey, applyTier }
}
