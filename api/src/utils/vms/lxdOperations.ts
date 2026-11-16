import type { LxdRequestOptions, LxdResponse } from './lxdTransport.ts'

type LxdRequest = <T>(path: string, options?: LxdRequestOptions) => Promise<LxdResponse<T>>

type LxdOperation = {
    id?: string
    description?: string
    resources?: Record<string, string[]>
}

type LxdOperations = {
    pending?: LxdOperation[]
    running?: LxdOperation[]
}

export async function waitForLxdOperation<T>(request: LxdRequest, operation: string | undefined, timeoutSeconds: number) {
    if (!operation) return
    const isOperationUrl = operation.includes('/1.0/operations/')
    const deadline = Date.now() + timeoutSeconds * 1000

    while (Date.now() < deadline) {
        // The LXD wait endpoint can return while the operation is still running.
        // Keep each long poll below the transport's 125-second inactivity limit.
        const remaining = Math.max(1, Math.ceil((deadline - Date.now()) / 1000))
        const waitSeconds = Math.min(60, remaining)
        let path: string
        if (isOperationUrl) {
            const url = new URL(operation, 'http://localhost')
            const query = new URLSearchParams(url.search)
            query.set('timeout', String(waitSeconds))
            path = `${url.pathname}/wait?${query.toString()}`
        } else {
            path = `/1.0/operations/${encodeURIComponent(operation)}/wait?timeout=${waitSeconds}`
        }

        const response = await request<T>(path, { timeout: (waitSeconds + 5) * 1000 })
        const result = response.metadata as { status?: unknown; status_code?: unknown; err?: unknown } | undefined
        const code = typeof result?.status_code === 'number' ? result.status_code : undefined
        const status = typeof result?.status === 'string' ? result.status.toLowerCase() : ''
        if ((code !== undefined && code >= 400) || ['failure', 'cancelled', 'canceled'].includes(status)) {
            const detail = typeof result?.err === 'string' && result.err.trim() ? result.err.trim() : `LXD operation ${status || code}.`
            throw new Error(detail)
        }
        if (code === 200 || (code === undefined && status === 'success')) return response
        if ((code !== undefined && code >= 100 && code < 200) || status === 'running' || status === 'pending') {
            await sleep(250)
            continue
        }
        throw new Error(`LXD operation returned an unknown status: ${status || code || 'missing'}.`)
    }

    throw new Error(`LXD operation did not finish within ${timeoutSeconds} seconds.`)
}

export async function waitForInstanceOperations(request: LxdRequest, name: string, timeoutSeconds: number) {
    const deadline = Date.now() + timeoutSeconds * 1000

    while (Date.now() < deadline) {
        const operations = (await request<LxdOperations>('/1.0/operations?recursion=1')).metadata
        const matches = getInstanceOperations(name, operations)
        if (!matches.length) return

        for (const operation of matches) {
            const remaining = Math.max(1, Math.ceil((deadline - Date.now()) / 1000))
            await waitForLxdOperation(request, operation.id, remaining)
        }
        await sleep(250)
    }

    throw new Error(`Timed out waiting for LXD operations to finish for ${name}.`)
}

function getInstanceOperations(name: string, operations: LxdOperations) {
    return [...(operations?.pending || []), ...(operations?.running || [])].filter(operation => {
        const description = (operation.description || '').toLowerCase()
        const isCreateLike = /creat|copy|clon|snapshot|restore/.test(description)
        const matchesInstance = (operation.resources?.instances || []).some(resource => {
            const resourceName = decodeURIComponent(resource.split('/').pop() || '')
            return resourceName === name
        })
        return matchesInstance && isCreateLike
    })
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
