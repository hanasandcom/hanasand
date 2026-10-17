import { DashboardPage } from '@/components/dashboard/ui'
import TimelinessClient from './timelinessClient'

export const dynamic = 'force-dynamic'

export default function TimelinessPage() {
    return (
        <DashboardPage>
            <TimelinessClient />
        </DashboardPage>
    )
}
