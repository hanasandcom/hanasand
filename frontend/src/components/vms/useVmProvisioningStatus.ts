import { useEffect } from 'react'
import getVM from '@/utils/vms/fetch/getVM'

export function useVmProvisioningStatus(name: string | undefined, updateStatus: (status: string) => void) {
    useEffect(() => {
        if (!name || new URLSearchParams(window.location.search).get('provisioning') !== '1') return
        let active = true
        const refresh = async () => {
            const vms = await getVM(name)
            if (!active || !vms?.[0]) return
            const vm = vms[0]
            if (vm.status_reason) updateStatus(vm.status_reason)
            if (vm.status === 'ERROR') {
                updateStatus(vm.status_reason || 'VM setup failed. Contact support if the problem persists.')
                clearInterval(timer)
            }
            if (vm.status === 'RUNNING') {
                updateStatus('VM is ready. Opening terminal…')
                clearInterval(timer)
            }
        }
        void refresh()
        const timer = setInterval(() => void refresh(), 2500)
        return () => { active = false; clearInterval(timer) }
    }, [name, updateStatus])
}
