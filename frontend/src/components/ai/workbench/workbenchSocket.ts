'use client'

export function createWorkbenchSocket(url: string) {
    if (typeof window !== 'undefined') {
        const customFactory = (window as typeof window & {
            __HANASAND_CREATE_SOCKET__?: (targetUrl: string) => WebSocket
        }).__HANASAND_CREATE_SOCKET__
        if (typeof customFactory === 'function') {
            return customFactory(url)
        }
    }

    return new WebSocket(url)
}
