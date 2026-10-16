import type { SeverityLevel } from '@/utils/monitoring/types'
import { severityClasses, severityLabel } from './constants'

type SeverityBadgeProps = { severity: SeverityLevel, count?: number, compact?: boolean }

export default function SeverityBadge({ severity, count, compact = false }: SeverityBadgeProps) {
    if (count === 0) return null

    const sizeClass = compact
        ? 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold'
        : 'rounded-full border px-2.5 py-1 text-xs font-medium'

    return <span className={`${sizeClass} ${severityClasses[severity]}`}>
        <span>{severityLabel[severity]}</span>
        {count === undefined ? null : compact ? <span>{count}</span> : ` ${count}`}
    </span>
}
