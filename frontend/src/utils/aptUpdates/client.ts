'use client'

import { getCookie } from 'hanasand/cookies'
import { backendJsonRequest } from '@/utils/auth/backendJsonRequest'

export type AptUpdate = { package: string, version: string, repo: string, origin: string, security: boolean, first_seen: number, installed_at?: number }
export type AptUpdateStatus = {
    schema_version?: number
    host?: string
    run_id?: string
    checked_at?: string
    status?: 'ok' | 'pending' | 'failed' | 'unknown'
    last_error?: string | null
    pending_updates?: AptUpdate[]
    installed_packages?: Array<{ package: string, version?: string }>
    last_updated_packages?: string[]
    last_update_at?: string | null
    policy?: { non_security_delay_hours?: number, security_install?: string, allowed_origin?: string, repository_verification?: string }
}
export type AptUpdateHistory = { run_id: string, status: string, occurred_at: string, is_today?: boolean, packages: string[], error: string | null }
export type UpdateHost = 'inspur' | 'ovhcloud'

export async function fetchAptUpdates(host: UpdateHost = 'inspur', signal?: AbortSignal) {
    return backendJsonRequest<{ status: AptUpdateStatus, history: AptUpdateHistory[] }>(`/system/updates?host=${host}`, {
        cache: 'no-store',
        signal,
        headers: { Authorization: `Bearer ${getCookie('access_token') || ''}`, id: getCookie('id') || '' },
        authenticated: false,
        errorMessage: 'Unable to load host update status.',
    })
}
