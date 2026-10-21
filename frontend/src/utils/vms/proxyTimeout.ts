const vmLifecycleActions = new Set(['start', 'stop', 'restart', 'restore'])
export const vmCreateTimeoutMs = 180_000

export function vmLifecycleProxyTimeoutMs(method: string, path: string[], defaultTimeout: number) {
    const lifecycleAction = method === 'POST'
        && path[0] === 'vm'
        && path.length === 3
        && vmLifecycleActions.has(path[2])
    const scheduledDeletion = method === 'DELETE' && path[0] === 'vm' && path.length === 2
    return lifecycleAction || scheduledDeletion ? Math.max(defaultTimeout, 150_000) : null
}

export function vmSetupPlanProxyTimeoutMs(method: string, path: string[], defaultTimeout: number) {
    const setupPlan = method === 'POST' && path[0] === 'vm' && path[1] === 'setup-plan' && path.length === 2
    return setupPlan ? Math.max(defaultTimeout, 30_000) : null
}

export function vmCreateProxyTimeoutMs(method: string, path: string[], defaultTimeout: number) {
    const createVm = method === 'POST' && path[0] === 'vm' && path.length === 1
    return createVm ? Math.max(defaultTimeout, vmCreateTimeoutMs) : null
}
