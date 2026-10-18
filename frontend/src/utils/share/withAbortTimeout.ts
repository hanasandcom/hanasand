export default async function withAbortTimeout<T>(
    timeoutMs: number,
    operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
        return await operation(controller.signal)
    } finally {
        clearTimeout(timeout)
    }
}
