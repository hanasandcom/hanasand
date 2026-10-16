type StorageByteSeparators = {
    byteUnit?: string
    scaledUnit?: string
}

export function formatRuleStorageBytes(value: number, separators: StorageByteSeparators = {}) {
    const { byteUnit = ' ', scaledUnit = ' ' } = separators
    if (value < 1024) return `${value}${byteUnit}B`

    const units = ['KB', 'MB', 'GB', 'TB']
    let amount = value / 1024
    let unit = 0
    while (amount >= 1024 && unit < units.length - 1) {
        amount /= 1024
        unit++
    }
    const rounded = amount >= 10 ? Math.round(amount) : amount.toFixed(1)
    return `${rounded}${scaledUnit}${units[unit]}`
}

export function formatRuleEstimateDate(value: string) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    if (!year || !month || !day) return ''
    const label = `${String(day).padStart(2, '0')}:${String(month).padStart(2, '0')}`
    const now = new Date()
    const nowYear = now.getUTCFullYear(), nowMonth = now.getUTCMonth(), nowDay = now.getUTCDate()
    const previousMonth = nowMonth === 0 ? 11 : nowMonth - 1
    const previousMonthYear = nowMonth === 0 ? nowYear - 1 : nowYear
    const previousMonthDay = Math.min(nowDay, new Date(Date.UTC(previousMonthYear, previousMonth + 1, 0)).getUTCDate())
    const olderThanMonth = Date.UTC(year, month - 1, day) < Date.UTC(previousMonthYear, previousMonth, previousMonthDay)
    return year !== nowYear && olderThanMonth ? `${label}:${year}` : label
}
