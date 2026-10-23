'use client'

import { getCookie, setCookieWithExpiresAt } from 'hanasand/cookies'
import type { NmapScanProfile, UvmAssessmentReport, UvmDashboard } from '@/utils/monitoring/types'

type UvmEngineId = 'nmap' | 'tenable-vm' | 'gvm' | 'zap'

const scannerUrl = (process.env.NEXT_PUBLIC_SCANNER_API_URL || 'https://scanner.hanasand.com/api').replace(/\/$/, '')

export const emptyUvmDashboard: UvmDashboard = {
    assets: [], coverage: [], engines: [], runs: [], assessments: [], findings: [], tenableScans: [],
    scannerError: 'Scanner service is loading.', tenableIntegration: null,
}

export function createScannerClient(organizationId: string) {
    const request = <T>(path: string, init: { method?: string, body?: unknown } = {}) =>
        scannerRequest<T>(organizationId, path, init)

    return {
        getDashboard: () => request<UvmDashboard>('/v1/uvm/dashboard'),
        createAsset: (input: { hostname: string }) => request<{ asset: UvmDashboard['assets'][number] }>('/v1/uvm/assets', { method: 'POST', body: input }),
        verifyAsset: (assetId: string) => request<{ asset: UvmDashboard['assets'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/verify`, { method: 'POST', body: {} }),
        saveZapApiDefinition: (assetId: string, path: string | null) => request<{ asset: UvmDashboard['assets'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/zap-api-definition`, { method: 'PUT', body: { path } }),
        runAsset: (assetId: string, authorized: boolean, profile: NmapScanProfile = 'tcp-top-1000') => request<{ run: UvmDashboard['runs'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/scans`, { method: 'POST', body: { requestId: crypto.randomUUID(), authorized, profile } }),
        scheduleAsset: (assetId: string, input: { enabled: boolean, intervalMinutes: number, authorized: boolean, engines: Array<{ engine: UvmEngineId, scanId?: string, profile?: NmapScanProfile }> }) => request<{ asset: UvmDashboard['assets'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/schedule`, { method: 'PUT', body: input }),
        configureTenable: (input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) => request<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>('/v1/uvm/integrations/tenable', { method: 'PUT', body: input }),
        disconnectTenable: () => request<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>('/v1/uvm/integrations/tenable', { method: 'DELETE', body: {} }),
        runTenable: (assetId: string, scanId: string, authorized: boolean) => request<{ run: UvmDashboard['runs'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/tenable-scans`, { method: 'POST', body: { requestId: crypto.randomUUID(), scanId, authorized } }),
        runGvm: (assetId: string, authorized: boolean) => request<{ run: UvmDashboard['runs'][number] }>('/v1/uvm/integrations/gvm/runs', { method: 'POST', body: { requestId: crypto.randomUUID(), organizationId, assetId, authorized } }),
        runZap: (assetId: string, authorized: boolean) => request<{ run: UvmDashboard['runs'][number] }>(`/v1/uvm/assets/${encodeURIComponent(assetId)}/zap-scans`, { method: 'POST', body: { requestId: crypto.randomUUID(), authorized } }),
        updateFinding: (findingId: string, input: { status: UvmDashboard['findings'][number]['status'], note: string }) => request(`/v1/uvm/findings/${encodeURIComponent(findingId)}`, { method: 'PUT', body: input }),
        cancelRun: (runId: string) => request<{ run: UvmDashboard['runs'][number] }>(`/v1/uvm/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST', body: {} }),
        startAssessment: (input: { requestId: string, assetIds: string[], engines: Array<{ engine: UvmEngineId, scanId?: string, profile?: NmapScanProfile }>, authorized: boolean }) => request<{ assessment: UvmDashboard['assessments'][number] }>('/v1/uvm/assessments', { method: 'POST', body: input }),
        cancelAssessment: (assessmentId: string) => request<{ assessment: UvmDashboard['assessments'][number] }>(`/v1/uvm/assessments/${encodeURIComponent(assessmentId)}/cancel`, { method: 'POST', body: {} }),
        getAssessmentReport: (assessmentId: string) => request<{ assessment: UvmAssessmentReport }>(`/v1/uvm/assessments/${encodeURIComponent(assessmentId)}/report`),
    }
}

async function scannerRequest<T>(organizationId: string, path: string, init: { method?: string, body?: unknown } = {}): Promise<T> {
    if (!organizationId) throw new Error('Choose an organization from the workspace selector to use Scanner.')
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
