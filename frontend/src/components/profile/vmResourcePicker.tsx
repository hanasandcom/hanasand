'use client'

import { vmResourceOptions } from '@/utils/vms/createOptions'
import VmOptionPicker, { type VmPickerOption } from './vmOptionPicker'

export default function VmResourcePicker({ value, onChange, disabled, availableOptions = vmResourceOptions }: {
    value: string
    onChange: (value: string) => void
    disabled: boolean
    availableOptions?: ReadonlyArray<typeof vmResourceOptions[number]>
}) {
    const describeOption = (option: VmPickerOption) => {
        if (option.id === 'custom') return 'Set up to 10 vCPU, 64 GB memory and 100 GB disk'
        return option.label.split(' · ').slice(1).join(' · ')
    }
    return <VmOptionPicker value={value} onChange={onChange} disabled={disabled} label='Resources' menuLabel='Resource options' options={availableOptions} description={describeOption} />
}
