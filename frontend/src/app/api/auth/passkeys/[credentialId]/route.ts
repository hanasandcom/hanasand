import { NextRequest } from 'next/server'
import { proxyAuthenticatedPasskeyRequest } from '../proxyJsonResponse'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ credentialId: string }> }) {
    const { credentialId } = await params
    const body = JSON.stringify(await req.json().catch(() => ({})))
    return proxyAuthenticatedPasskeyRequest(`/${encodeURIComponent(credentialId)}`, { method: 'PATCH', body })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ credentialId: string }> }) {
    const { credentialId } = await params
    return proxyAuthenticatedPasskeyRequest(`/${encodeURIComponent(credentialId)}`, { method: 'DELETE' })
}
