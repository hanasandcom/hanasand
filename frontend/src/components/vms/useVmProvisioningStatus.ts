import { useEffect, useState } from 'react'
import getVM from '@/utils/vms/fetch/getVM'

export type VmProvisioningFeedback = {
    state: 'provisioning' | 'ready' | 'error'
    message: string
}

export function getVmProvisioningFeedback(status?: string, statusReason?: string): VmProvisioningFeedback {
    const normalizedStatus = status?.toUpperCase()
    if (normalizedStatus === 'ERROR') {
        return {
            state: 'error',
            message: statusReason || 'VM setup failed. Contact support if the problem persists.',
        }
    }
    if (normalizedStatus === 'RUNNING') {
        return { state: 'ready', message: 'VM is ready. Your selected services are installed.' }
    }
    if (normalizedStatus === 'PROVISIONING' && statusReason) {
        return { state: 'provisioning', message: statusReason }
    }
    if (normalizedStatus === 'OFFLINE') {
        return { state: 'provisioning', message: 'Waiting for the VM host to respond…' }
    }
    return { state: 'provisioning', message: 'Starting your VM and selected services…' }
}

export function getVmProvisioningUnavailableFeedback(): VmProvisioningFeedback {
    return {
        state: 'provisioning',
        message: 'Unable to refresh setup status. The VM may still be provisioning; this console will keep checking.',
    }
}

export function useVmProvisioningStatus(name: string | undefined, enabled = true, organizationId?: string) {
    const [feedback, setFeedback] = useState<VmProvisioningFeedback | null>(null)

    useEffect(() => {
        if (!enabled || !name || new URLSearchParams(window.location.search).get('provisioning') !== '1') {
            setFeedback(null)
            return
        }

        let active = true
        let consecutiveUnavailableReads = 0
        let timer: number | undefined
        const refresh = async () => {
            const vms = await getVM(name, undefined, undefined, organizationId || null)
            if (!active) return
            const vm = vms?.[0]
            if (!vm) {
                consecutiveUnavailableReads += 1
                if (consecutiveUnavailableReads >= 1) setFeedback(getVmProvisioningUnavailableFeedback())
            } else {
                consecutiveUnavailableReads = 0
                const next = getVmProvisioningFeedback(vm.status, vm.status_reason)
                setFeedback(next)
                if (next.state !== 'provisioning') return
            }
            if (active) timer = window.setTimeout(() => void refresh(), 2500)
        }

        setFeedback(getVmProvisioningFeedback())
        void refresh()
        return () => {
            active = false
            if (timer !== undefined) window.clearTimeout(timer)
        }
    }, [name, enabled, organizationId])

    return feedback
}
