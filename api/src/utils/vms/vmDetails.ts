import run from '#db'

export type VmDetails = {
    name: string
    status: string
    type: string
    architecture: string
    created: string
    last_used: string
    config_architecture: string
    config_image_architecture: string
    config_image_description: string
    config_image_label: string
    config_image_os: string
    config_image_release: string
    config_image_serial: string
    config_image_type: string
    config_image_version: string
    limits_cpu: string
    limits_memory: string
    volatile_base_image: string
    volatile_cloud_init_instance_id: string
    volatile_eth0_hwaddr: string
    volatile_last_state_power: string
    volatile_uuid: string
    volatile_uuid_generation: string
    volatile_vsock_id: string
    device_eth0_ipv4_address: string
    device_eth0_name: string
    device_eth0_network: string
    device_eth0_type: string
    ephemeral: boolean
    stateful: boolean
    description: string
    profiles: string[]
    last_checked: string
}

const vmDetailsColumns = [
    'name', 'status', 'type', 'architecture', 'created', 'last_used',
    'config_architecture', 'config_image_architecture', 'config_image_description',
    'config_image_label', 'config_image_os', 'config_image_release', 'config_image_serial',
    'config_image_type', 'config_image_version', 'limits_cpu', 'limits_memory',
    'volatile_base_image', 'volatile_cloud_init_instance_id', 'volatile_eth0_hwaddr',
    'volatile_last_state_power', 'volatile_uuid', 'volatile_uuid_generation', 'volatile_vsock_id',
    'device_eth0_ipv4_address', 'device_eth0_name', 'device_eth0_network', 'device_eth0_type',
    'ephemeral', 'stateful', 'description', 'profiles', 'last_checked',
] as const satisfies readonly (keyof VmDetails)[]

const vmDetailsUpdateColumns = vmDetailsColumns.filter(column => column !== 'name')

export async function writeVmDetails(details: VmDetails) {
    const columns = vmDetailsColumns.join(', ')
    const placeholders = vmDetailsColumns.map((_, index) => `$${index + 1}`).join(', ')
    const updates = vmDetailsUpdateColumns.map(column => `${column} = EXCLUDED.${column}`).join(', ')

    return run(`
        INSERT INTO vm_details (${columns})
        VALUES (${placeholders})
        ON CONFLICT (name) DO UPDATE SET ${updates}
        RETURNING *
    `, vmDetailsColumns.map(column => details[column]))
}
