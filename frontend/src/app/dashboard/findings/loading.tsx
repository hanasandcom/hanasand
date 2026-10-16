import DashboardThreeColumnLoading from '@/app/dashboard/DashboardThreeColumnLoading'

export default function DashboardDwmLoading() {
    return (
        <DashboardThreeColumnLoading
            eyebrow='Dark web monitoring'
            title='Dark web cases'
            description='Loading recent attacks, evidence, source health, and delivery state.'
            tabs={['Cases', 'Active', 'Critical', 'Ready', 'Watchlist', 'Webhook']}
            listItemHeight='h-28'
            detailPanelHeight='h-80'
            inspectorCardHeight='h-52'
        />
    )
}
