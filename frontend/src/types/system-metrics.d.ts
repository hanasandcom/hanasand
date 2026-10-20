type SystemMetric = {
    name: string
    value: string | number
    icon?: React.ReactNode
}

type SystemMemorySnapshot = {
    used: number
    total: number
    percent: string
}

type SystemSnapshot = {
    load: number[]
    memory: SystemMemorySnapshot
    swap: string
    disk: string
    temperature: string
    powerUsage: string
    processes: number
    ipv4: string[]
    ipv6: string[]
    os: string
}

type SystemMetricsApiResponse = {
    system: SystemSnapshot | null
    unavailable_reason?: string
    generated_at?: string
}

type DockerContainerPort = {
    ip?: string
    private_port: number
    public_port?: number
    type: string
}

type DockerContainerStats = {
    cpu_percent: number | null
    memory_bytes: number | null
    memory_limit_bytes: number | null
    memory_percent: number | null
}

type DockerContainer = {
    id: string
    name: string
    image?: string
    state?: string
    status: string
    cpu?: number | null
    memory?: number | null
    ports?: DockerContainerPort[]
    restart_count?: number
    health?: string
    uptime_seconds?: number | null
    stats?: DockerContainerStats | null
    stats_unavailable_reason?: string
    stats_updated_at?: string
    created_at?: string
}

type DockerTelemetryResponse = {
    containers: DockerContainer[]
    source?: string
    docker_socket_available?: boolean
    unavailable_reason?: string
    generated_at?: string
}

type VM = {
    managed?: boolean
    deleted_at?: string | null
    delete_after?: string | null
    deletion_error?: string | null
    deletion_restore?: { instanceMissing?: boolean } | null
    name: string
    owner: string
    created_by: string
    organization_id?: string | null
    organization_name?: string | null
    can_assign_organization?: boolean
    access_users: string[]
    always_running_premium: boolean
    always_running_enabled: boolean
    failover_premium: boolean
    failover_enabled: boolean
    primary_host: string
    failover_host: string | null
    status: string
    type: string
    architecture: string
    created: string
    last_used: string
    config_image_description: string
    config_image_os: string
    config_image_version: string
    limits_cpu: string
    limits_memory: string
    device_eth0_ipv4_address: string
    last_checked: string
}

type VMMetrics = {
    id: number
    name: string
    cpu_usage_percent: number
    cpu_cores: number
    cpu_temperature: number
    ram_used_mb: number
    ram_total_mb: number
    gpu_usage_percent: number
    gpu_memory_used_mb: number
    gpu_memory_total_mb: number
    gpu_temperature: number
    system_temperature: number
    disk_used_mb: number
    disk_total_mb: number
    disk_read_iops: number
    disk_write_iops: number
    net_in_kbps: number
    net_out_kbps: number
    power_state: 'on' | 'off' | 'suspended' | 'idle'
    power_consumption_watts: number
    powered_on_at?: string
    powered_off_at?: string
    uptime_seconds: number
    uptime_total_seconds: number
    load_average_1: number
    load_average_5: number
    load_average_15: number
    created_at: string
}

type MetricSummary = {
    value: string
    hits_today: number
    hits_last_week: number
    hits_this_month?: number
    hits_total: number
}

type RequestLog = {
    metric: 'ip' | 'user_agent' | 'path'
    value: string
    path: string
    hits: number
    last_seen: string
    created_at: string
}

type Project = {
    alias: string
    owner: string
    editors: string[]
    file_count: number
    total_size: number
    last_updated: string
}

type VMDetails = {
    last_checked: string
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
    ephemeral: string | boolean
    stateful: string | boolean
    description: string
    profiles: string[]
}
