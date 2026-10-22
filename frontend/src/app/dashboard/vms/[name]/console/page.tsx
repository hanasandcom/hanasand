import VmConsole from '@/components/vms/consoleClient'
import { DashboardPage } from 'hanasand/dashboard'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
    const { name } = await params
    return <DashboardPage><VmConsole name={name} /></DashboardPage>
}
