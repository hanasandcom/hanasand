import type { WorkbenchCase } from './types'

export function severityPriority(severity: WorkbenchCase['severity']) {
    if (severity === 'critical') return 400
    if (severity === 'high') return 300
    if (severity === 'medium') return 200
    return 100
}

export function pluralize(word: string, count: number) {
    return count === 1 ? word : `${word}s`
}
