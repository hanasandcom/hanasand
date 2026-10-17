import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { ChevronDown } from 'lucide-react'
import { severityOrder } from './constants'
import MiniStat from './miniStat'
import SeverityBadge from './severityBadge'

export default function ImageSummaryActions({
    image,
    isExpanded,
    onToggle,
}: {
    image: ImageVulnerabilityReport
    isExpanded: boolean
    onToggle: () => void
}) {
    return (
        <div className='flex shrink-0 items-center gap-1.5 overflow-x-auto'>
            <MiniStat label='Total' value={String(image.totalVulnerabilities)} compact />
            {severityOrder.map((severity) => (
                <SeverityBadge key={`${image.image}-${severity}`} severity={severity} count={image.severity[severity]} compact />
            ))}
            {image.totalVulnerabilities === 0 ? (
                <span className='inline-flex items-center rounded-full border border-ui-success/35 bg-ui-success/10 px-2 py-0.5 text-xs font-semibold text-ui-success'>clear</span>
            ) : null}
            <button
                type='button'
                onClick={(event) => {
                    event.stopPropagation()
                    onToggle()
                }}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? `Collapse ${image.image}` : `Expand ${image.image}`}
                className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md
                    border border-ui-border bg-ui-raised text-ui-muted transition
                    hover:border-ui-primary/35 hover:bg-ui-panel'
            >
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
        </div>
    )
}
