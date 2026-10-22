'use client'

import { getCookie, setCookieWithExpiresAt } from 'hanasand/cookies'
import type { UvmDashboard } from '@/utils/monitoring/types'

const scannerUrl = (process.env.NEXT_PUBLIC_SCANNER_API_URL || 'https://scanner.hanasand.com/api').replace(/\/$/, '')
const organizationId = '3e735e7b-4d7f-444d-9806-231fa26cfcec'

export const emptyUvmDashboard: UvmDashboard = {
    assets: [], coverage: [], engines: [], runs: [], assessments: [], findings: [], tenableScans: [],
    scannerError: 'Scanner service is loading.', tenableIntegration: null,
}

export async function scannerRequest<T>(path: string, init: { method?: string, body?: unknown } = {}): Promise<T> {
    const token = getCookie('access_token') || ''
    const id = getCookie('id') || ''
    const separator = path.includes('?') ? '&' : '?'
    const response = await fetch(`${scannerUrl}${path}${separator}organizationId=${encodeURIComponent(organizationId)}`, {
        method: init.method || 'GET', cache: 'no-store',
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id: decodeURIComponent(id),
            ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
    const result = await response.json().catch(() => ({})) as T & { error?: string, message?: string }
    const refreshedToken = response.headers.get('x-access-token')
    if (refreshedToken) setCookieWithExpiresAt('access_token', refreshedToken, response.headers.get('x-access-token-expires-at'))
    if (!response.ok) throw new Error(result.message || result.error || `Scanner request failed (${response.status}).`)
    return result
}

export const getScannerDashboard = () => scannerRequest<UvmDashboard>('/v1/uvm/dashboard')
export const createScannerAsset = (input: { hostname: string }) => scannerRequest<{ asset: UvmDashboard['assets'][number] }>('/v1/uvm/assets', { method: 'POST', body: input })
export const verifyScannerAsset = (assetId: string) => scannerRequest<{ asset: UvmDashboard['assets'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/verify`, { method: 'POST', body: {} })
export const runScannerAsset = (assetId: string, authorized: boolean, profile: 'tcp-top-100' | 'tcp-top-1000' = 'tcp-top-1000') => scannerRequest<{ run: UvmDashboard['runs'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/scans`, { method: 'POST', body: { requestId: crypto.randomUUID(), authorized, profile } })
export const scheduleScannerAsset = (assetId: string, input: { enabled: boolean, intervalMinutes: number, authorized: boolean, engine: 'nmap' | 'tenable-vm' | 'gvm', scanId?: string, profile?: 'tcp-top-100' | 'tcp-top-1000' }) => scannerRequest<{ asset: UvmDashboard['assets'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/schedule`, { method: 'PUT', body: input })
export const configureScannerTenable = (input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) => scannerRequest<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>('/v1/uvm/integrations/tenable', { method: 'PUT', body: input })
export const disconnectScannerTenable = () => scannerRequest<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>('/v1/uvm/integrations/tenable', { method: 'DELETE', body: {} })
export const runScannerTenable = (assetId: string, scanId: string, authorized: boolean) => scannerRequest<{ run: UvmDashboard['runs'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/tenable-scans`, { method: 'POST', body: { requestId: crypto.randomUUID(), scanId, authorized } })
export const updateScannerFinding = (findingId: string, input: { status: UvmDashboard['findings'][number]['status'], note: string }) => scannerRequest(`/v1/uvm/findings/${encodeURIComponent(findingId)}`, { method: 'PUT', body: input })
export const cancelScannerRun = (runId: string) => scannerRequest<{ run: UvmDashboard['runs'][number] }>(`/v1/uvm/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST', body: {} })
export const startScannerAssessment = (input: { requestId: string, assetIds: string[], engines: Array<{ engine: 'nmap' | 'gvm' | 'tenable-vm', scanId?: string, profile?: 'tcp-top-100' | 'tcp-top-1000' }>, authorized: boolean }) => scannerRequest<{ assessment: UvmDashboard['assessments'][number] }>('/v1/uvm/assessments', { method: 'POST', body: input })
export const cancelScannerAssessment = (assessmentId: string) => scannerRequest<{ assessment: UvmDashboard['assessments'][number] }>(`/v1/uvm/assessments/${encodeURIComponent(assessmentId)}/cancel`, { method: 'POST', body: {} })
