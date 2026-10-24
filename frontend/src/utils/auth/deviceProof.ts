'use client'

export type DevicePublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string }
export type DeviceProof = { proof: string; publicJwk: DevicePublicJwk; url: string }

declare global {
    interface Window {
        hanasandDeviceProofReady?: Promise<{ publicJwk: DevicePublicJwk; create(token: string, method: string, url: string): Promise<DeviceProof>; sync(token?: string): Promise<void> }>
        hanasandDeviceProof?: { publicJwk: DevicePublicJwk; create(token: string, method: string, url: string): Promise<DeviceProof>; sync(token?: string): Promise<void> }
    }
}

export async function ensureDeviceProof() {
    if (typeof window === 'undefined') throw new Error('Device proof is only available in a browser.')
    if (!window.hanasandDeviceProofReady) throw new Error('Device proof setup has not started.')
    return window.hanasandDeviceProofReady
}

export async function getDevicePublicJwk() {
    return (await ensureDeviceProof()).publicJwk
}

export async function createDeviceProof(token: string, method: string, url: string) {
    return (await ensureDeviceProof()).create(token, method, url)
}

export async function createDeviceProofHeaders(token: string, method: string, url: string): Promise<Record<string, string>> {
    const { proof, url: proofUrl } = await createDeviceProof(token, method, url)
    return {
        DPoP: proof,
        'x-device-proof-method': method.toUpperCase(),
        'x-device-proof-url': proofUrl,
    }
}
