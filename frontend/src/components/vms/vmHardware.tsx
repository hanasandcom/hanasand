import Field from './field'
import { VmPanel } from './vmPanel'
import { formatMegabytes } from '@/utils/vms/metricPresentation'

type VMDetailsProps = {
    vm: VM
    diskTotalMb?: number | null
}

export default function VMHardware({ vm, diskTotalMb = null }: VMDetailsProps) {
    return (
        <VmPanel title='Hardware'>
            <Field title='CPU' value={vm.limits_cpu} />
            <Field title='Memory' value={vm.limits_memory} />
            <Field title='Disk' value={diskTotalMb === null ? null : formatMegabytes(diskTotalMb)} />
        </VmPanel>
    )
}
