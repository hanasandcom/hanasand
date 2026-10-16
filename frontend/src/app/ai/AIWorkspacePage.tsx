import { cookies } from 'next/headers'
import AIPageClient from './pageClient'
import { getUserShares } from '@/utils/share/getUserShares'
import { getAiWorkspace } from '@/utils/ai/getWorkspace'

type AIWorkspaceRouteParams = Promise<{ id: string }>

export default async function AIWorkspacePage({ params }: { params?: AIWorkspaceRouteParams } = {}) {
    const [cookieStore, routeParams] = await Promise.all([
        cookies(),
        params ?? Promise.resolve(undefined),
    ])
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    const [shares, workspace] = await Promise.all([
        id && token ? getUserShares({ id, token }) : Promise.resolve([]),
        getAiWorkspace({ id, token }),
    ])

    return (
        <AIPageClient
            initialConversations={workspace.conversations}
            initialRepositories={workspace.repositories}
            initialDeployments={workspace.deployments}
            initialReleases={workspace.releases}
            initialDeployQuota={workspace.deployQuota}
            initialOwnershipSummary={workspace.ownershipSummary}
            initialShares={Array.isArray(shares) ? shares : []}
            initialRuntimeState={workspace.runtimeState}
            isAuthenticated={Boolean(id && token)}
            {...(routeParams ? { initialConversationId: routeParams.id } : {})}
            mode='workspace'
        />
    )
}
