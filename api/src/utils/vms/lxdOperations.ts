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
    if (isOperationUrl) {
        const url = new URL(operation, 'http://localhost')
        const query = new URLSearchParams(url.search)
        query.set('timeout', String(timeoutSeconds))
        return request<T>(`${url.pathname}/wait?${query.toString()}`)
    }
    return request<T>(`/1.0/operations/${encodeURIComponent(operation)}/wait?timeout=${timeoutSeconds}`)
}

export async function waitForInstanceOperations(request: LxdRequest, name: string, timeoutSeconds: number) {
    const deadline = Date.now() + timeoutSeconds * 1000

    while (Date.now() < deadline) {
        const operations = await request<LxdOperations>('/1.0/operations?recursion=1')
            .then(response => response.metadata)
            .catch(() => null)
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

function getInstanceOperations(name: string, operations: LxdOperations | null) {
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
