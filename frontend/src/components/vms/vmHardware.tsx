import Field from './field'
import { VmPanel } from './vmPanel'

type VMDetailsProps = {
    vm: VM
}

export default function VMHardware({ vm }: VMDetailsProps) {
    return (
        <VmPanel title='Hardware'>
            <Field title='CPU' value={vm.limits_cpu} />
            <Field title='Memory' value={vm.limits_memory} />
            <Field title='Disk' value='Not reported' />
        </VmPanel>
    )
}
