import { NextRequest } from 'next/server'
import { proxyAuthenticatedPasskeyRequest } from '../proxyJsonResponse'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ credentialId: string }> }) {
    const { credentialId } = await params
    const body = JSON.stringify(await req.json().catch(() => ({})))
    return proxyAuthenticatedPasskeyRequest(req, `/${encodeURIComponent(credentialId)}`, { method: 'PATCH', body })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ credentialId: string }> }) {
    const { credentialId } = await params
    return proxyAuthenticatedPasskeyRequest(req, `/${encodeURIComponent(credentialId)}`, { method: 'DELETE' })
}
