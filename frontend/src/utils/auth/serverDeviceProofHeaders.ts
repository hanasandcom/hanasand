import 'server-only'
import { headers } from 'next/headers'

export default async function serverDeviceProofHeaders(): Promise<Record<string, string>> {
    const request = await headers()
    const proof = request.get('dpop')
    const url = request.get('x-device-proof-url')
    if (!proof || !url) return {}
    return {
        DPoP: proof,
        'x-device-proof-url': url,
        'x-device-proof-method': request.get('x-device-proof-method') || 'GET',
    }
}
