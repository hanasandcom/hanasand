import { DashboardPanel } from 'hanasand/dashboard'
import UsersList from './usersList'

export default function Users({ users, accessibleOrganizationIds = [] }: { users: User[], accessibleOrganizationIds?: string[] }) {
    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full gap-2 p-4'>
            <UsersList users={users} accessibleOrganizationIds={accessibleOrganizationIds} />
        </DashboardPanel>
    )
}
