(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.crypto?.subtle) return
    if (window.hanasandDeviceProofReady) return

    const channel = 'hanasand-device-proof'
    const encoder = new TextEncoder()
    let worker

    function base64Url(bytes) {
        let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
    }

    function tokenFromCookie() {
        const token = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('access_token='))?.slice('access_token='.length)
        if (!token) return ''
        try { return decodeURIComponent(token) } catch { return token }
    }

    function tokenFromHeaders(headers) {
        const authorization = headers.get('authorization')
        return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : tokenFromCookie()
    }

    function messageWorker(type, fields = {}) {
        if (!worker) return Promise.reject(new Error('Device proof worker is not ready.'))
        return new Promise((resolve, reject) => {
            const channelPort = new MessageChannel()
            const timeout = setTimeout(() => reject(new Error('Device proof worker timed out.')), 5000)
            channelPort.port1.onmessage = event => {
                clearTimeout(timeout)
                channelPort.port1.close()
                if (event.data?.error) reject(new Error(event.data.error))
                else resolve(event.data)
            }
            worker.postMessage({ channel, type, ...fields }, [channelPort.port2])
        })
    }

    function isHanasandOrigin(url) {
        return url.protocol === 'https:' && (url.hostname === 'hanasand.com' || url.hostname.endsWith('.hanasand.com'))
    }

    function normalizedUrl(value) {
        const url = new URL(value)
        if (url.protocol === 'wss:') url.protocol = 'https:'
        if (url.protocol === 'ws:') url.protocol = 'http:'
        url.search = ''
        url.hash = ''
        return url.toString().replace(/\/$/, '')
    }

    async function syncTokenHash(token = tokenFromCookie()) {
        const value = token ? base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)))) : ''
        await messageWorker('update-token-hash', { tokenHash: value })
    }

    window.hanasandDeviceProofReady = (async () => {
        const registration = await navigator.serviceWorker.register('/device-proof-sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
        worker = registration.active || navigator.serviceWorker.controller
        if (!worker) throw new Error('Device proof worker is not active.')
        const { publicJwk } = await messageWorker('get-public-key')
        if (!publicJwk) throw new Error('Device proof key could not be created.')
        await syncTokenHash()

        const originalFetch = window.fetch.bind(window)
        window.fetch = async (input, init) => {
            const requestInput = input instanceof Request ? input : new URL(String(input), window.location.href)
            const request = new Request(requestInput, init)
            const url = new URL(request.url)
            if (!isHanasandOrigin(url)) return originalFetch(request)

            const headers = new Headers(request.headers)
            const token = tokenFromHeaders(headers)
            const authenticationRequest = url.pathname.startsWith('/api/auth/')
            if (!token && !authenticationRequest) return originalFetch(request)

            headers.set('X-Device-Public-Jwk', JSON.stringify(publicJwk))
            headers.set('X-Device-Proof-Url', normalizedUrl(url))
            headers.set('X-Device-Proof-Method', request.method.toUpperCase())
            if (token) {
                const { proof } = await messageWorker('create-proof', { token, method: request.method, url: normalizedUrl(url) })
                headers.set('DPoP', proof)
            }

            const response = await originalFetch(new Request(request, { headers }))
            const tokenHash = response.headers.get('x-device-proof-token-hash')
            if (tokenHash) await messageWorker('update-token-hash', { tokenHash })
            else if (response.headers.has('set-cookie')) await syncTokenHash()
            return response
        }

        window.hanasandDeviceProof = {
            publicJwk,
            create: async (token, method, url) => {
                const result = await messageWorker('create-proof', { token, method, url: normalizedUrl(url) })
                return { proof: result.proof, publicJwk: result.publicJwk, url: normalizedUrl(url) }
            },
            sync: syncTokenHash,
        }
        window.dispatchEvent(new Event('hanasand-device-proof-ready'))
        window.addEventListener('pageshow', () => { void syncTokenHash() })
        window.addEventListener('focus', () => { void syncTokenHash() })
        return window.hanasandDeviceProof
    })().catch(error => {
        window.dispatchEvent(new CustomEvent('hanasand-device-proof-error', { detail: error instanceof Error ? error.message : 'Device proof setup failed.' }))
        throw error
    })
})()
