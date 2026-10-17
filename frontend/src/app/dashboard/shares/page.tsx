import Shares from '@/components/share/dashboard/projects'
import { DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <Shares />
        </DashboardPage>
    )
}
