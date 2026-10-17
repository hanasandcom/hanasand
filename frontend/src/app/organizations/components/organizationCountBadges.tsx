import { OrganizationMetadataBadge } from './shared'

type CountItem = { label: string, count: number }
type Marker = 'data-org-member-status-counts' | 'data-org-invite-status-counts' | 'data-org-watchlist-status-counts'

export function OrganizationCountBadges({ counts, className, marker, hideZero = false }: {
    counts: CountItem[]
    className: string
    marker: Marker
    hideZero?: boolean
}) {
    const visibleCounts = hideZero ? counts.filter(item => item.count > 0) : counts
    return <div className={className} {...{ [marker]: 'true' }}>
        {visibleCounts.map((item, index) => <OrganizationMetadataBadge key={`${index}-${item.label}`}>
            {item.label}: {item.count}
        </OrganizationMetadataBadge>)}
    </div>
}
