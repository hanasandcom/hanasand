export type CdpClient = {
    send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>
    close: () => void
}

export async function createCdpClient(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('CDP socket timed out.')), 8000)
        socket.addEventListener('open', () => {
            clearTimeout(timeout)
            resolve()
        }, { once: true })
        socket.addEventListener('error', () => {
            clearTimeout(timeout)
            reject(new Error('CDP socket failed.'))
        }, { once: true })
    })
    let nextId = 1
    const pending = new Map<number, { resolve: (value: Record<string, unknown>) => void, reject: (error: Error) => void }>()
    socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as { id?: number, result?: Record<string, unknown>, error?: { message?: string } }
        if (!message.id || !pending.has(message.id)) {
            return
        }
        const waiter = pending.get(message.id)
        pending.delete(message.id)
        if (!waiter) return
        if (message.error) {
            waiter.reject(new Error(message.error.message || 'CDP command failed.'))
        } else {
            waiter.resolve(message.result || {})
        }
    })
    return {
        send(method, params = {}) {
            const id = nextId
            nextId += 1
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject })
                socket.send(JSON.stringify({ id, method, params }))
                setTimeout(() => {
                    if (!pending.has(id)) return
                    pending.delete(id)
                    reject(new Error(`${method} timed out.`))
                }, 12000)
            })
        },
        close() {
            socket.close()
        },
    }
}

export async function waitForPageReady(client: CdpClient, url: string, signal: AbortSignal) {
    await withAbort(client.send('Page.navigate', { url }), signal)
    for (let index = 0; index < 24; index += 1) {
        signal.throwIfAborted()
        await sleep(500)
        const state = await withAbort(client.send('Runtime.evaluate', {
            expression: 'document.readyState',
            returnByValue: true,
        }), signal)
        if ((state?.result as { value?: unknown } | undefined)?.value === 'complete') {
            return
        }
    }
}

export function abortReason(signal: AbortSignal) {
    return signal.reason instanceof Error ? signal.reason : new DOMException('Verification job cancelled.', 'AbortError')
}

export function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(abortReason(signal))
    return new Promise((resolve, reject) => {
        const cleanup = () => signal.removeEventListener('abort', onAbort)
        const onAbort = () => {
            cleanup()
            reject(abortReason(signal))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        promise.then(value => {
            cleanup()
            resolve(value)
        }, error => {
            cleanup()
            reject(error)
        })
    })
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
