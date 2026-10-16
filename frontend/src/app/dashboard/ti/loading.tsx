import DashboardThreeColumnLoading from '@/app/dashboard/DashboardThreeColumnLoading'

export default function DashboardTiLoading() {
    return (
        <DashboardThreeColumnLoading
            eyebrow='Threat intelligence'
            title='Loading'
            description='Loading collection, recent attacks, actor profiles, sources, and review state.'
            tabs={['Collection', 'Attacks', 'Activity', 'Actors', 'Sources', 'Runs']}
            listItemHeight='h-24'
            detailPanelHeight='h-72'
            inspectorCardHeight='h-44'
        />
    )
}
