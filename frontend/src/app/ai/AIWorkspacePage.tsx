import { cookies } from 'next/headers'
import AIPageClient from './pageClient'
import { getUserShares } from '@/utils/share/getUserShares'
import { getAiWorkspace } from '@/utils/ai/getWorkspace'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import { redirect } from 'next/navigation'

type AIWorkspaceRouteParams = Promise<{ id: string }>

export default async function AIWorkspacePage({ params }: { params?: AIWorkspaceRouteParams } = {}) {
    const [cookieStore, routeParams] = await Promise.all([
        cookies(),
        params ?? Promise.resolve(undefined),
    ])
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    const [shares, workspace, canUseChatGPT] = await Promise.all([
        id && token ? getUserShares({ id, token }) : Promise.resolve([]),
        getAiWorkspace({ id, token }),
        id && token ? isHanasandOrganizationMember(token, id).catch(() => false) : Promise.resolve(false),
    ])

    if (workspace.authStatus === 'unauthorized' && id && token) {
        const returnPath = routeParams ? `/ai/${routeParams.id}` : '/ai'
        redirect(`/login?path=${encodeURIComponent(returnPath)}&expired=true`)
    }

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
            initialWorkspaceUnavailable={workspace.authStatus === 'unavailable'}
            canUseChatGPT={canUseChatGPT}
            {...(routeParams ? { initialConversationId: routeParams.id } : {})}
            mode='workspace'
        />
    )
}
