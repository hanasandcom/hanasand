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

export function localProvisionFailureReason(error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    if (/limits\.disk/i.test(detail)) return 'The selected disk size exceeds the host’s remaining disk quota. Choose a smaller disk size or contact Support.'
    if (/limits\.memory/i.test(detail)) return 'The selected memory allocation exceeds the host’s remaining quota. Choose a smaller allocation or contact Support.'
    if (/limits\.cpu/i.test(detail)) return 'The selected CPU allocation exceeds the host’s remaining quota. Choose a smaller allocation or contact Support.'
    if (/limits\.(?:instances|virtual-machines)/i.test(detail)) return 'The host has no available VM capacity for this setup. Try again later or contact Support.'
    return 'VM setup could not start. Try again or contact Support if the problem persists.'
}
