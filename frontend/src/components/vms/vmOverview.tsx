import smallDate from '@/utils/date/smallDate'
import Field from './field'
import { VmPanel } from './vmPanel'

type VMDetailsProps = {
    vm: VM
    details: VMDetails | null
}

export default function VMOverview({ vm, details }: VMDetailsProps) {
    const editors = Array.isArray(vm.access_users) && vm.access_users.length ? vm.access_users.join(', ') : 'Only you'
    const description = details?.description || 'Description stream is empty'

    return (
        <VmPanel title='Overview'>
            <Field title='Name' value={vm.name} />
            <Field title='Owner' value={vm.organization_name || vm.owner} />
            <Field title='Created by' value={vm.created_by} />
            <Field title='Created at' value={vm.created} />
            <Field title='Type' value={vm.type} />
            <Field title='Last used' value={smallDate(vm.last_used)} />
            <Field title='Editors' value={editors} />
            <Field title='Description' value={description} />
        </VmPanel>
    )
}
