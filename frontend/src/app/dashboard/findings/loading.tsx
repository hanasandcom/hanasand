import DashboardThreeColumnLoading from '@/app/dashboard/DashboardThreeColumnLoading'

export default function DashboardDwmLoading() {
    return (
        <DashboardThreeColumnLoading
            tabs={['Cases', 'Active', 'Critical', 'Ready', 'Watchlist', 'Webhook']}
            listItemHeight='h-28'
            detailPanelHeight='h-80'
            inspectorCardHeight='h-52'
        />
    )
}
