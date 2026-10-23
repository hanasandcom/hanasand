import 'server-only'
import { headers } from 'next/headers'
import { decodeInternalHeaderValue } from '@/utils/proxy/internalHeaderValue'

type VerifiedServerSession = { id: string; token: string }

function serverSessionAssertionHeaders(id: string, token: string): Record<string, string> {
    const assertion = process.env.VM_API_TOKEN
    if (!assertion || !id || !token) return {}
    return {
        'x-hanasand-server-session-validated': '1',
        'x-hanasand-server-session-id': id,
        'x-hanasand-server-session-token': token,
        'x-hanasand-server-session-assertion': assertion,
    }
}

export default async function serverDeviceProofHeaders(verifiedSession?: VerifiedServerSession): Promise<Record<string, string>> {
    if (verifiedSession) return serverSessionAssertionHeaders(verifiedSession.id, verifiedSession.token)
    const request = await headers()
    const sessionId = decodeInternalHeaderValue(request.get('x-hanasand-session-id'))
    const sessionToken = request.get('x-hanasand-session-token')
    const serverToken = process.env.VM_API_TOKEN
    if (request.get('x-hanasand-session-validated') === '1') {
        if (!sessionId || !sessionToken || !serverToken) return {}
        return serverSessionAssertionHeaders(sessionId, sessionToken)
    }
    const proof = request.get('dpop')
    const url = request.get('x-device-proof-url')
    if (!proof || !url) return {}
    return {
        DPoP: proof,
        'x-device-proof-url': url,
        'x-device-proof-method': request.get('x-device-proof-method') || 'GET',
    }
}
