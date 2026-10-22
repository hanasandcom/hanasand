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

export function useVmProvisioningStatus(name: string | undefined) {
    const [feedback, setFeedback] = useState<VmProvisioningFeedback | null>(null)

    useEffect(() => {
        if (!name || new URLSearchParams(window.location.search).get('provisioning') !== '1') {
            setFeedback(null)
            return
        }

        let active = true
        const refresh = async () => {
            const vms = await getVM(name, undefined, undefined, null)
            if (!active) return
            const vm = vms?.[0]
            if (!vm) return

            const next = getVmProvisioningFeedback(vm.status, vm.status_reason)
            setFeedback(next)
            if (next.state !== 'provisioning') clearInterval(timer)
        }

        setFeedback(getVmProvisioningFeedback())
        void refresh()
        const timer = setInterval(() => void refresh(), 2500)
        return () => { active = false; clearInterval(timer) }
    }, [name])

    return feedback
}
