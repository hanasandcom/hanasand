import DashboardThreeColumnLoading from '@/app/dashboard/DashboardThreeColumnLoading'

export default function DashboardTiLoading() {
    return (
        <DashboardThreeColumnLoading
            tabs={['Collection', 'Attacks', 'Activity', 'Actors', 'Sources', 'Runs']}
            listItemHeight='h-24'
            detailPanelHeight='h-72'
            inspectorCardHeight='h-44'
        />
    )
}
