'use client'

import { useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { validateScopeSet, type DraftApiKey } from './model'

export function useApiKeyCollection(initialKeys: ApiKeySummary[], setSaving: (saving: boolean) => void) {
    const [apiKeys, setApiKeys] = useState(initialKeys)
    const [message, setMessage] = useState<string | null>(null)
    const [issuedSecret, setIssuedSecret] = useState<string | null>(null)

    async function createKey(draft: DraftApiKey, requiredValid: boolean, requiredMessage: string, scopeValid: boolean, scopeMessage: string, resetDraft: () => void) {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
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
            const response = await fetch(`${config.url.api}/rate-limit/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${decodeURIComponent(token)}`,
                    id,
                },
                body: JSON.stringify({
                    ownerId: draft.ownerId.trim(),
                    name: draft.name.trim(),
                    tier: draft.tier.trim() || 'custom',
                    description: draft.description.trim() || null,
                    enabled: draft.enabled,
                    expiresAt: draft.expiresAt || null,
                    scopes: draft.scopes,
                }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(payload?.error || 'Unable to create API key.')
            if (payload?.apiKey) setApiKeys((previous) => [payload.apiKey as ApiKeySummary, ...previous])
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
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
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
            const response = await fetch(`${config.url.api}/rate-limit/keys/${apiKey.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${decodeURIComponent(token)}`,
                    id,
                },
                body: JSON.stringify(apiKey),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(payload?.error || 'Unable to update API key.')
            if (payload?.apiKey) {
                setApiKeys((previous) => previous.map((entry) => entry.id === apiKey.id ? payload.apiKey as ApiKeySummary : entry))
            }
            setMessage('API key updated.')
        } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : 'Unable to update API key.')
        } finally {
            setSaving(false)
        }
    }

    async function deleteKey(idToDelete: string) {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setMessage('You need to sign in again before deleting API keys.')
            return
        }

        setSaving(true)
        setMessage(null)
        try {
            const response = await fetch(`${config.url.api}/rate-limit/keys/${idToDelete}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${decodeURIComponent(token)}`, id },
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(payload?.error || 'Unable to delete API key.')
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
