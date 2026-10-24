type RequestTarget = { url: string; method: string; headers: Headers }

// Next standalone reconstructs request.url with its loopback listener. Device
// proofs must keep the public website target, independent of that internal hop.
export function backendDeviceProofTarget(
    request: RequestTarget,
    configuredOrigin = process.env.SOCIAL_AUTH_ORIGIN || 'https://hanasand.com',
    allowLocalStageOrigin = process.env.HANASAND_STAGE_BUILD === '1',
) {
    try {
        const origin = new URL(configuredOrigin)
        const isLocalStageOrigin = allowLocalStageOrigin && origin.origin === 'http://127.0.0.1:3388'
        if ((!isLocalStageOrigin && origin.protocol !== 'https:') || origin.username || origin.password
            || origin.pathname !== '/' || origin.search || origin.hash) return null
        const url = `${origin.origin}${new URL(request.url).pathname}`
        const method = request.method.toUpperCase()
        const suppliedUrl = request.headers.get('x-device-proof-url')
        const suppliedMethod = request.headers.get('x-device-proof-method')
        if (suppliedUrl && suppliedUrl !== url) return null
        if (suppliedMethod && suppliedMethod !== method) return null
        return { url, method }
    } catch {
        return null
    }
}
