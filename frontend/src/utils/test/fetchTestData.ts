import config from '@/config'

export async function fetchTestData<T>(url: string, project?: (data: unknown) => T): Promise<T | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
    let timeoutPending = true

    try {
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        timeoutPending = false
        if (!response.ok) throw new Error(`Failed to fetch test: ${response.status}`)
        const data: unknown = await response.json()
        return project ? project(data) : data as T
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error(`Request timed out after ${config.abortTimeout}ms`)
        } else {
            console.error(`Error fetching test: ${error}`)
        }
        return null
    } finally {
        if (timeoutPending) clearTimeout(timeout)
    }
}
