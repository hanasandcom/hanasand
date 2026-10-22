type LocalProvisionStatus = {
    status: 'Provisioning' | 'Error'
    status_reason: string
}

const maxTrackedVms = 512
const states = new Map<string, LocalProvisionStatus>()

export function setLocalProvisionState(name: string, state: LocalProvisionStatus) {
    const key = name.toLowerCase()
    if (!states.has(key) && states.size >= maxTrackedVms) {
        const oldest = states.keys().next().value
        if (oldest) states.delete(oldest)
    }
    states.delete(key)
    states.set(key, state)
}

export function getLocalProvisionState(name: string) {
    return states.get(name.toLowerCase())
}

export function clearLocalProvisionState(name: string) {
    states.delete(name.toLowerCase())
}
