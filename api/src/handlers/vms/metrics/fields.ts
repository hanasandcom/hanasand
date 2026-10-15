const writableMetricFields = new Set([
    'name',
    'cpu_usage_percent',
    'cpu_cores',
    'cpu_temperature',
    'ram_used_mb',
    'ram_total_mb',
    'gpu_usage_percent',
    'gpu_memory_used_mb',
    'gpu_memory_total_mb',
    'gpu_temperature',
    'system_temperature',
    'disk_used_mb',
    'disk_total_mb',
    'disk_read_iops',
    'disk_write_iops',
    'net_in_kbps',
    'net_out_kbps',
    'power_state',
    'power_consumption_watts',
    'powered_on_at',
    'powered_off_at',
    'uptime_seconds',
    'uptime_total_seconds',
    'load_average_1',
    'load_average_5',
    'load_average_15',
    'created_at',
])

const integerFields = new Set(['cpu_cores', 'ram_used_mb', 'ram_total_mb', 'gpu_memory_used_mb', 'gpu_memory_total_mb', 'disk_used_mb', 'disk_total_mb', 'disk_read_iops', 'disk_write_iops', 'net_in_kbps', 'net_out_kbps'])
const bigintFields = new Set(['uptime_seconds', 'uptime_total_seconds'])
const timestampFields = new Set(['powered_on_at', 'powered_off_at', 'created_at'])
const numericPrecision = new Map([
    ['cpu_usage_percent', 5], ['cpu_temperature', 5],
    ['gpu_usage_percent', 5], ['gpu_temperature', 5],
    ['system_temperature', 5], ['power_consumption_watts', 10],
    ['load_average_1', 6], ['load_average_5', 6], ['load_average_15', 6],
])
const powerStates = new Set(['on', 'off', 'suspended', 'idle'])

export function isWritableMetricField(field: string) {
    return writableMetricFields.has(field)
}

export function isValidMetricValue(field: string, value: unknown) {
    if (value === null) return field !== 'name'
    if (field === 'name') return typeof value === 'string'
    if (field === 'power_state') return typeof value === 'string' && powerStates.has(value)
    if (timestampFields.has(field)) return typeof value === 'string' && Number.isFinite(Date.parse(value))

    if (integerFields.has(field)) {
        if (typeof value === 'number') return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647
        return typeof value === 'string' && /^[+-]?\d+$/.test(value.trim()) && Number(value) >= -2147483648 && Number(value) <= 2147483647
    }

    if (bigintFields.has(field)) {
        if (typeof value === 'number') return Number.isSafeInteger(value)
        if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value.trim())) return false
        try {
            const integer = BigInt(value.trim())
            return integer >= -9223372036854775808n && integer <= 9223372036854775807n
        } catch {
            return false
        }
    }

    const precision = numericPrecision.get(field)
    if (precision) {
        const numericText = typeof value === 'string' ? value.trim() : ''
        const isNumericText = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(numericText)
        const number = typeof value === 'number' ? value : isNumericText ? Number(numericText) : Number.NaN
        // PostgreSQL rounds to two decimal places before enforcing NUMERIC precision.
        return Number.isFinite(number) && Math.abs(number) < 10 ** (precision - 2) - 0.005
    }

    return false
}
