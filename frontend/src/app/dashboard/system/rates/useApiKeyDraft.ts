'use client'

import { useMemo, useState } from 'react'
import { createPresetLimits, emptyDraft, validateKeyFields, validateScopeSet, type DraftApiKey } from './model'

export function useApiKeyDraft(routes: RateLimitRoute[], tierPresetMap: Record<string, ApiKeyTierDefinition>) {
    const [draft, setDraft] = useState<DraftApiKey>(emptyDraft)
    const scopeValidation = useMemo(() => validateScopeSet(draft.scopes), [draft.scopes])
    const requiredValidation = useMemo(() => validateKeyFields(draft), [draft])
    const ready = requiredValidation.valid && scopeValidation.valid
    const readiness = !requiredValidation.valid
        ? requiredValidation.message
        : !scopeValidation.valid ? scopeValidation.message : 'Ready to issue'

    function addScope() {
        const firstRoute = routes[0]
        setDraft((prev) => ({
            ...prev,
            scopes: [...prev.scopes, {
                id: crypto.randomUUID(),
                enabled: true,
                method: firstRoute?.method || 'GET',
                route: firstRoute?.route || '/api/',
                limits: createPresetLimits(draft.tier, tierPresetMap),
            }],
        }))
    }

    function removeScope(scopeId: string) {
        setDraft((prev) => ({ ...prev, scopes: prev.scopes.filter((scope) => scope.id !== scopeId) }))
    }

    function applyTier(tier: string) {
        setDraft((prev) => ({
            ...prev,
            tier,
            scopes: prev.scopes.map((scope) => ({ ...scope, limits: createPresetLimits(tier, tierPresetMap) })),
        }))
    }

    return { draft, setDraft, scopeValidation, requiredValidation, ready, readiness, addScope, removeScope, applyTier }
}
