type PostVmDetails = {
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
    ephemeral: string
    stateful: string
    description: string
    profiles: string[]
}
type AgentVmMissingCapability = {
    key: 'remote_command_execution' | 'remote_file_write' | 'remote_terminal_stream' | 'remote_repo_sync'
    reason: string
}

type AgentVmTarget = {
    id: string
    name: string
    owner: string
    createdBy: string
    accessUsers: string[]
    status: string
    type: string
    architecture: string
    imageDescription: string
    createdAt: string
    lastUsedAt: string
    lastCheckedAt: string
    network: {
        ipv4: string
        sshHost: string | null
        sshUser: string
    }
    resources: {
        cpu: string
        memory: string
    }
    capabilities: {
        canView: boolean
        canConnect: boolean
        canManage: boolean
        canSyncAuthorizedKeys: boolean
        canExecuteRemoteCommands: boolean
        canWriteRemoteFiles: boolean
        supportedActions: Array<'start' | 'stop' | 'restart'>
        supportedConnectionMethods: Array<'ssh'>
        missingCapabilities: AgentVmMissingCapability[]
    }
    endpoints: {
        summary: string
        details: string
        connection: string
        syncAuthorizedKeys: string
        request: string
        actions: Partial<Record<'start' | 'stop' | 'restart', string>>
    }
    suggestedFlow: {
        selection: 'vm' | 'unavailable'
        connect: string | null
        prerequisites: string[]
        notes: string[]
    }
}

type AgentExecutionTarget = {
    id: string
    label: string
    kind: 'local_workspace' | 'vm'
    transport: 'local_process' | 'hanasand_vm_api'
    summary: string
    readiness: 'ready' | 'partial'
    trustBoundary: 'local' | 'remote'
    target: AgentVmTarget | {
        kind: 'local_workspace'
        supportedWorkspaceKinds: Array<'share' | 'repo'>
        supportedOperations: string[]
        missingCapabilities: string[]
    }
}
