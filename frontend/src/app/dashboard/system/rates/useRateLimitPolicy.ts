'use client'

import { useMemo, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { fallbackSettings, validateOverrideSet } from './model'

export function useRateLimitPolicy(initialSettings: RateLimitSettings | null, routes: RateLimitRoute[], setSaving: (saving: boolean) => void) {
    const [settings, setSettings] = useState<RateLimitSettings>(initialSettings || fallbackSettings)
    const [message, setMessage] = useState<string | null>(null)
    const routeOptions = useMemo(() => routes.map((route) => `${route.method} ${route.route}`), [routes])
    const overrideValidation = useMemo(() => validateOverrideSet(settings.overrides), [settings.overrides])
    const overrideCount = settings.overrides.filter((override) => override.enabled).length

    async function saveSettings() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setMessage('You need to sign in again before saving rate-limit settings.')
            return
        }
        if (!overrideValidation.valid) {
            setMessage(overrideValidation.message)
            return
        }

        setSaving(true)
        setMessage(null)
        try {
            const response = await fetch(`${config.url.api}/rate-limit/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${decodeURIComponent(token)}`,
                    id,
                },
                body: JSON.stringify(settings),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(payload?.error || 'Unable to save rate-limit settings.')
            setSettings(payload?.settings && typeof payload.settings === 'object' ? payload.settings as RateLimitSettings : settings)
            setMessage('Rate-limit settings saved.')
        } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : 'Unable to save rate-limit settings.')
        } finally {
            setSaving(false)
        }
    }

    function updateDefault(scope: RateLimitScope, field: keyof RateLimitRule, value: number) {
        setSettings((prev) => ({
            ...prev,
            defaults: { ...prev.defaults, [scope]: { ...prev.defaults[scope], [field]: value } },
        }))
    }

    function updateOverride(id: string, field: keyof RateLimitOverride, value: string | number | boolean) {
        setSettings((prev) => ({
            ...prev,
            overrides: prev.overrides.map((override) => override.id === id ? { ...override, [field]: value } : override),
        }))
    }

    function addOverride() {
        const firstRoute = routes[0]
        setSettings((prev) => ({
            ...prev,
            overrides: [...prev.overrides, {
                id: crypto.randomUUID(),
                enabled: true,
                method: firstRoute?.method || 'GET',
                route: firstRoute?.route || '/api/',
                scope: 'anonymous',
                windowMs: prev.defaults.anonymous.windowMs,
                maxRequests: prev.defaults.anonymous.maxRequests,
            }],
        }))
    }

    function removeOverride(id: string) {
        setSettings((prev) => ({ ...prev, overrides: prev.overrides.filter((override) => override.id !== id) }))
    }

    return {
        settings, setSettings, message, routeOptions, overrideValidation, overrideCount,
        saveSettings, updateDefault, updateOverride, addOverride, removeOverride,
    }
}
