import BlocklistClient from './blocklistClient'
import getBlocklist from '@/utils/traffic/getBlocklist'
import { DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const blocklist = await getBlocklist()

    return (
        <DashboardPage>
            <BlocklistClient initialBlocklist={Array.isArray(blocklist) ? blocklist : []} />
        </DashboardPage>
    )
}
