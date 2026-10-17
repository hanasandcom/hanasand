import type { WebScanCheck } from '@/utils/monitoring/types'

type Props = {
    check: Pick<WebScanCheck, 'title' | 'severity' | 'status'>
    className: string
    titleClassName?: string
    resultClassName: string
}

export default function WebScanCheckMeta({ check, className, titleClassName, resultClassName }: Props) {
    return (
        <div className={className}>
            <span className={titleClassName}>{check.title}</span>
            <span className={resultClassName}>{check.severity} · {check.status}</span>
        </div>
    )
}
