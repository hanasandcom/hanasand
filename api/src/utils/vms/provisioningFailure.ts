const genericFailureReason = 'VM setup could not start. Try again or contact Support if the problem persists.'

export function publicVmProvisioningFailureReason(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    if (/limits\.disk|disk.{0,40}(?:quota|capacity)|(?:quota|capacity).{0,40}disk/i.test(message)) {
        return 'There is not enough disk capacity on the VM host for this plan. Choose a smaller disk or contact Support.'
    }
    if (/limits\.(?:cpu|memory)|(?:cpu|memory).{0,40}(?:quota|capacity)|(?:quota|capacity).{0,40}(?:cpu|memory)/i.test(message)) {
        return 'The VM host does not have enough CPU or memory capacity for this plan. Choose fewer resources or contact Support.'
    }
    if (/limits\.(?:instances|virtual-machines)|maximum.*(?:instance|virtual machine)|(?:instance|virtual machine).{0,40}(?:quota|limit)/i.test(message)) {
        return 'The VM host has reached its VM limit. Remove an unused VM or contact Support.'
    }
    return genericFailureReason
}
