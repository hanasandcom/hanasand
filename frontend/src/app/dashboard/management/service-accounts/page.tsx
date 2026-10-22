import ServiceAccounts from '@/components/users/serviceAccounts'
import { DashboardPage, DashboardPanel } from 'hanasand/dashboard'

export default function Page() {
    return <DashboardPage>
        <DashboardPanel className='p-4'><ServiceAccounts /></DashboardPanel>
    </DashboardPage>
}
