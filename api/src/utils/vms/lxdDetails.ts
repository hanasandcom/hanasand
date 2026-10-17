import { isIPv4 } from 'node:net'
import config from '#constants'

export type LxdInstance = {
    name: string
    status?: string
    type?: string
    architecture?: string
    created_at?: string
    last_used_at?: string
    config?: Record<string, string>
    devices?: Record<string, Record<string, string>>
    expanded_devices?: Record<string, Record<string, string>>
    profiles?: string[]
    description?: string
    ephemeral?: boolean
    stateful?: boolean
}

export type LxdState = {
    status?: string
    network?: Record<string, {
        hwaddr?: string
        addresses?: Array<{ family?: string, address?: string, scope?: string }>
    }>
}

export function mapLxdDetails(instance: LxdInstance, state: LxdState | null) {
    const configValues = instance.config || {}
    const eth0 = instance.expanded_devices?.eth0 || instance.devices?.eth0 || {}
    const currentStatus = state?.status || instance.status || ''
    // VM guests may rename eth0 (for example to enp5s0). Match the attached
    // NIC by name, MAC or its configured IP, never the first guest bridge.
    const mac = configValues['volatile.eth0.hwaddr']?.toLowerCase()
    const primaryNetwork = Object.entries(state?.network || {}).find(([name, network]) =>
        name === (eth0.name || 'eth0')
        || Boolean(mac && network.hwaddr?.toLowerCase() === mac)
        || Boolean(eth0['ipv4.address'] && network.addresses?.some(address => address.address === eth0['ipv4.address']))
    )
    // The guest agent can report no interfaces during startup. The NIC's
    // assigned static address is still valid; never reuse old telemetry.
    const assignedIpv4 = eth0['ipv4.address'] || ''
    const ipv4 = primaryNetwork?.[1].addresses
        ?.find(address => address.family === 'inet' && address.scope !== 'link' && address.scope !== 'local')?.address
        || (isIPv4(assignedIpv4) ? assignedIpv4 : '')
    const now = new Date().toISOString()

    return {
        name: instance.name,
        status: currentStatus || 'unknown',
        type: instance.type || 'container',
        architecture: instance.architecture || '',
        created: instance.created_at || '',
        last_used: instance.last_used_at || '',
        config_architecture: configValues['image.architecture'] || instance.architecture || '',
        config_image_architecture: configValues['image.architecture'] || '',
        config_image_description: configValues['image.description'] || config.lxd_image_alias,
        config_image_label: configValues['image.label'] || '',
        config_image_os: configValues['image.os'] || 'ubuntu',
        config_image_release: configValues['image.release'] || config.lxd_image_alias.replace(/^.*?(\d+\.\d+).*$/, '$1'),
        config_image_serial: configValues['image.serial'] || '',
        config_image_type: configValues['image.type'] || instance.type || 'container',
        config_image_version: configValues['image.version'] || configValues['image.release'] || '',
        limits_cpu: configValues['limits.cpu'] || '1',
        limits_memory: configValues['limits.memory'] || '1GiB',
        volatile_base_image: configValues['volatile.base_image'] || '',
        volatile_cloud_init_instance_id: configValues['volatile.cloud-init.instance-id'] || '',
        volatile_eth0_hwaddr: configValues['volatile.eth0.hwaddr'] || '',
        volatile_last_state_power: currentStatus.toUpperCase(),
        volatile_uuid: configValues['volatile.uuid'] || '',
        volatile_uuid_generation: configValues['volatile.uuid.generation'] || '',
        volatile_vsock_id: configValues['volatile.vsock_id'] || '',
        device_eth0_ipv4_address: ipv4,
        device_eth0_name: primaryNetwork?.[0] || eth0.name || 'eth0',
        device_eth0_network: eth0.network || '',
        device_eth0_type: eth0.type || 'nic',
        ephemeral: Boolean(instance.ephemeral),
        stateful: Boolean(instance.stateful),
        description: instance.description || '',
        profiles: instance.profiles || [],
        last_checked: now,
    }
}
