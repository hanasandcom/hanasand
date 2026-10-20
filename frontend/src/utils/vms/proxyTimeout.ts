const vmLifecycleActions = new Set(['start', 'stop', 'restart', 'restore'])

export function vmLifecycleProxyTimeoutMs(method: string, path: string[], defaultTimeout: number) {
    const lifecycleAction = method === 'POST'
        && path[0] === 'vm'
        && path.length === 3
        && vmLifecycleActions.has(path[2])
    const scheduledDeletion = method === 'DELETE' && path[0] === 'vm' && path.length === 2
    return lifecycleAction || scheduledDeletion ? Math.max(defaultTimeout, 150_000) : null
}
