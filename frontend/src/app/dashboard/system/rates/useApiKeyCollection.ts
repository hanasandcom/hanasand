'use client'

import { useState } from 'react'
import { validateScopeSet, type DraftApiKey } from './model'
import { rateLimitHeaders, requestRateLimit } from './rateLimitRequest'

export function useApiKeyCollection(initialKeys: ApiKeySummary[], setSaving: (saving: boolean) => void) {
    const [apiKeys, setApiKeys] = useState(initialKeys)
    const [message, setMessage] = useState<string | null>(null)
    const [issuedSecret, setIssuedSecret] = useState<string | null>(null)

    async function createKey(draft: DraftApiKey, requiredValid: boolean, requiredMessage: string, scopeValid: boolean, scopeMessage: string, resetDraft: () => void) {
        const headers = rateLimitHeaders()
        if (!headers) {
            setMessage('You need to sign in again before issuing API keys.')
            return
        }
        if (!requiredValid) {
            setMessage(requiredMessage)
            return
        }
        if (!scopeValid) {
            setMessage(scopeMessage)
            return
        }

        setSaving(true)
        setMessage(null)
        setIssuedSecret(null)
        try {
            const payload = await requestRateLimit<{ apiKey?: ApiKeySummary, secret?: string }>('/keys', headers, {
                method: 'POST',
                fallbackMessage: 'Unable to create API key.',
                body: {
                    ownerId: draft.ownerId.trim(),
                    name: draft.name.trim(),
                    tier: draft.tier.trim() || 'custom',
                    description: draft.description.trim() || null,
                    enabled: draft.enabled,
                    expiresAt: draft.expiresAt || null,
                    scopes: draft.scopes,
                },
            })
            const createdKey = payload?.apiKey
            if (createdKey) setApiKeys((previous) => [createdKey, ...previous])
            setIssuedSecret(typeof payload?.secret === 'string' ? payload.secret : null)
            resetDraft()
            setMessage('API key issued.')
        } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : 'Unable to create API key.')
        } finally {
            setSaving(false)
        }
    }

    async function updateKey(apiKey: ApiKeySummary) {
        const headers = rateLimitHeaders()
        if (!headers) {
            setMessage('You need to sign in again before updating API keys.')
            return
        }
        const validation = validateScopeSet(apiKey.scopes)
        if (!validation.valid) {
            setMessage(validation.message)
            return
        }

        setSaving(true)
        setMessage(null)
        try {
            const payload = await requestRateLimit<{ apiKey?: ApiKeySummary }>(`/keys/${apiKey.id}`, headers, {
                method: 'PUT',
                fallbackMessage: 'Unable to update API key.',
                body: apiKey,
            })
            const updatedKey = payload?.apiKey
            if (updatedKey) {
                setApiKeys((previous) => previous.map((entry) => entry.id === apiKey.id ? updatedKey : entry))
            }
            setMessage('API key updated.')
        } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : 'Unable to update API key.')
        } finally {
            setSaving(false)
        }
    }

    async function deleteKey(idToDelete: string) {
        const headers = rateLimitHeaders()
        if (!headers) {
            setMessage('You need to sign in again before deleting API keys.')
            return
        }
        setSaving(true)
        setMessage(null)
        try {
            await requestRateLimit(`/keys/${idToDelete}`, headers, {
                method: 'DELETE',
                fallbackMessage: 'Unable to delete API key.',
            })
            setApiKeys((previous) => previous.filter((entry) => entry.id !== idToDelete))
            setMessage('API key deleted.')
        } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : 'Unable to delete API key.')
        } finally {
            setSaving(false)
        }
    }

    return { apiKeys, setApiKeys, message, issuedSecret, setIssuedSecret, createKey, updateKey, deleteKey }
}
