import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { bearerToken, objectValue, parseJsonObject, stringValue, type JsonRecord } from './watchlistDwmValues'

export type DwmOrganizationMirrorPayload = {
    id: string
    name: string
    slug?: string
    status: 'active' | 'suspended'
    ownerUserId?: string
}

export function buildDwmOrganizationMirrorPayload(input: { organizationPayload: JsonRecord, ownerUserId?: string }): DwmOrganizationMirrorPayload | null {
    const organization = objectValue(input.organizationPayload.organization) ?? input.organizationPayload
    const id = stringValue(organization.id)
    const name = stringValue(organization.name)
    if (!id || !name) return null
    const lifecycleStatus = String(organization.lifecycleStatus ?? organization.status ?? 'active').toLowerCase()
    return {
        id,
        name,
        slug: stringValue(organization.slug),
        status: lifecycleStatus === 'active' ? 'active' : 'suspended',
        ownerUserId: input.ownerUserId,
    }
}

export async function mirrorOrganizationToDwm(request: NextRequest, organizationPayload: JsonRecord) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || bearerToken(request.headers.get('authorization')) || ''
    const id = cookieStore.get('id')?.value || request.headers.get('id') || ''
    const mirrorPayload = buildDwmOrganizationMirrorPayload({ organizationPayload, ownerUserId: id })
    if (!base) return { ok: false, skipped: true, reason: 'ti_scraper_api_base_unset', mirrorPayload }
    if (!mirrorPayload) return { ok: false, skipped: true, reason: 'missing_organization', mirrorPayload: null }
    return mirrorOrganizationToDwmResult({
        base,
        mirrorPayload,
        authHeaders: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id, 'x-actor-id': id, 'x-user-id': id } : {}),
        },
    })
}

export async function mirrorOrganizationToDwmResult(input: {
    base: string
    mirrorPayload: DwmOrganizationMirrorPayload
    authHeaders?: Record<string, string>
    fetchImpl?: typeof fetch
}) {
    try {
        const response = await (input.fetchImpl ?? fetch)(new URL('/v1/organizations', input.base), {
            method: 'POST',
            cache: 'no-store',
            headers: { 'content-type': 'application/json', ...input.authHeaders },
            body: JSON.stringify(input.mirrorPayload),
            signal: AbortSignal.timeout(12000),
        })
        const payload = parseJsonObject(await response.text())
        return {
            ok: response.ok,
            status: response.status,
            organizationId: stringValue(objectValue(payload.organization)?.id) ?? input.mirrorPayload.id,
            error: response.ok ? undefined : payload.error ?? payload,
        }
    } catch (error) {
        return {
            ok: false,
            status: 502,
            organizationId: input.mirrorPayload.id,
            error: { code: 'dwm_organization_mirror_failed', message: error instanceof Error ? error.message : String(error) },
        }
    }
}
