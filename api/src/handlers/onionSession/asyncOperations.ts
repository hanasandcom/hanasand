export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeoutMs)),
    ])
}
