'use client'

import { vmOperatingSystems } from '@/utils/vms/createOptions'
import VmOptionPicker from './vmOptionPicker'

export default function VmOperatingSystemPicker({ value, onChange, disabled }: { value: string, onChange: (value: string) => void, disabled: boolean }) {
    return <VmOptionPicker value={value} onChange={onChange} disabled={disabled} label='Operating system' menuLabel='Operating systems' promptLabel='Choose an image' options={vmOperatingSystems} />
}
