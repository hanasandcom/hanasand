import Projects from '@/components/projects/projects'
import { DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <Projects />
        </DashboardPage>
    )
}
