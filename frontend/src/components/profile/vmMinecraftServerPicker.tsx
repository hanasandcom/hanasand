'use client'

import { vmMinecraftServerTypes } from '@/utils/vms/createOptions'
import VmOptionPicker from './vmOptionPicker'

export default function VmMinecraftServerPicker({ value, onChange, disabled }: {
    value: typeof vmMinecraftServerTypes[number]['id']
    onChange: (value: typeof vmMinecraftServerTypes[number]['id']) => void
    disabled: boolean
}) {
    return <VmOptionPicker value={value} onChange={value => onChange(value as typeof vmMinecraftServerTypes[number]['id'])} disabled={disabled} label='Server software' menuLabel='Minecraft server software' options={vmMinecraftServerTypes} />
}
