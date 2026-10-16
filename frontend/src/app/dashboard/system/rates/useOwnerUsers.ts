'use client'

import { useCallback, useEffect, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { normalizeOwnerUser, sortOwnerUsers, type OwnerUserOption } from './model'

export function useOwnerUsers() {
    const [users, setUsers] = useState<OwnerUserOption[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reload = useCallback(async () => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setError('Sign in again to search users.')
            return
        }

        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`${config.url.api}/users`, {
                headers: { Authorization: `Bearer ${decodeURIComponent(token)}`, id },
            })
            const payload = await response.json().catch(() => [])
            if (response.status === 404) {
                setUsers([])
                return
            }
            if (!response.ok) throw new Error(payload?.error || 'Unable to load users.')
            const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.users) ? payload.users : []
            setUsers((rows.map(normalizeOwnerUser).filter(Boolean) as OwnerUserOption[]).sort(sortOwnerUsers))
        } catch (cause) {
            setUsers([])
            setError(cause instanceof Error ? cause.message : 'Unable to load users.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void reload() }, [reload])

    return { users, loading, error, reload }
}
