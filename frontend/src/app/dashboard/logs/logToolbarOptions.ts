export const logPages = [
    ['Dashboard', '/logs'],
    ['Realtime', '/logs/realtime'],
    ['Search', '/logs/search'],
    ['Errors', '/logs/errors'],
    ['Traffic', '/traffic'],
]

export const logTimeRanges = [['1', 'Last hour'], ['24', 'Last 24 hours'], ['168', 'Last 7 days'], ['720', 'Last 30 days'], ['2160', 'Last 90 days']]
export const logSeverityValues = ['low', 'medium', 'high', 'critical']

export function isActiveLogPath(pathname: string, href: string) {
    return pathname === href || pathname === `/dashboard${href}`
}
