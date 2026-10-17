import SharePageClient from './clientPage'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTree } from '@/utils/share/getTree'
import { getShare } from '@/utils/share/get'
import getProject from '@/utils/projects/getProject'
import { readShareRoutePreferences } from '@/utils/share/routePreferences'
import { walkWorkspaceTree } from '@/utils/share/walkWorkspaceTree'

export default async function Page(props: {
    params: Promise<{ id: string[] }>
    searchParams: Promise<{ chat?: string, new?: string }>
}) {
    const params = await props.params
    const searchParams = await props.searchParams
    const id = params.id[0]
    const isNewWorkspace = searchParams.new === '1'
    const initialChatOpen = searchParams.chat === '1'
    const Cookies = await cookies()
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const { openFolders, openFiles, sharePageWidth, shareTerminalHeight } = readShareRoutePreferences(Cookies, 'share')
    const [fetchedTree, fetchedShare] = isNewWorkspace
        ? [createOptimisticTree(id), createOptimisticShare(id)] as const
        : await Promise.all([
            getTree({ id, token, userId }),
            getShare({ id, token, userId }),
        ])
    const safeShare = typeof fetchedShare === 'string' ? null : fetchedShare
    const shouldCreateWorkspace = isNewWorkspace || !safeShare
    const tree = shouldCreateWorkspace ? createOptimisticTree(id) : fetchedTree
    const share = shouldCreateWorkspace ? createOptimisticShare(id) : safeShare
    const isProject = safeShare && safeShare.alias !== safeShare.id && Array.isArray(fetchedTree)
        && [...walkWorkspaceTree(fetchedTree)].length > 1

    if (!isNewWorkspace && isProject) {
        redirect(`/p/${safeShare.alias}?file=${safeShare.id}`)
    }

    if (!isNewWorkspace && !safeShare) {
        const project = await getProject({ alias: id, token, userId })
        if (project) {
            redirect(`/p/${id}`)
        }
    }

    return (
        <div className='w-full h-full'>
            <SharePageClient
                id={id}
                share={share}
                openFolders={openFolders}
                tree={tree}
                sharePageWidth={sharePageWidth}
                shareTerminalHeight={shareTerminalHeight}
                serverOpenFiles={openFiles}
                autoCreate={shouldCreateWorkspace}
                initialChatOpen={initialChatOpen}
                replaceUrlOnCreate
            />
        </div>
    )
}

function createOptimisticShare(id: string): Share {
    return {
        id,
        path: id,
        content: '',
        wordCount: 0,
        estimatedMinutes: 0,
        timestamp: new Date().toISOString(),
        git: null,
        locked: false,
        owner: '',
        parent: '',
        alias: id,
    }
}

function createOptimisticTree(id: string): Tree {
    return [{
        id,
        type: 'folder',
        name: id,
        alias: id,
        parent: null,
        children: [],
    }]
}
