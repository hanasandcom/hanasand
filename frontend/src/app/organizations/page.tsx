import type { Metadata } from 'next'
import OrganizationWorkspaceClient from './organizationWorkspaceClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Organizations | Hanasand',
    description: 'Manage organizations, members, shared watchlists, event scope, cases, and webhook destinations.',
}

export default async function Page() {
    return <OrganizationWorkspaceClient />
}
