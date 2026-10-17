import type { ReactNode } from 'react'
import { DashboardPage } from './ui'

type Props = {
    hasContent: boolean
    emptyState: ReactNode
    renderContent: () => ReactNode
}

export function DashboardPublishingPage({ hasContent, emptyState, renderContent }: Props) {
    return <DashboardPage>
        {hasContent ? renderContent() : emptyState}
    </DashboardPage>
}
