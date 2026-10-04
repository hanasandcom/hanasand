import { notFound } from 'next/navigation'
import { organizationPages } from '@/utils/organizations/pages'
import OrganizationWorkspaceClient from '../organizationWorkspaceClient'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
    const { section } = await params
    const page = organizationPages.find(item => item.id === section)
    if (!page) notFound()
    return <OrganizationWorkspaceClient page={page.id} />
}
