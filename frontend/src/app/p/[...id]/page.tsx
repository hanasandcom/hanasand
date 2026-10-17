import SharePageClient from '@/app/s/[...id]/clientPage'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import getProject from '@/utils/projects/getProject'
import { getShare } from '@/utils/share/get'
import { readShareRoutePreferences } from '@/utils/share/routePreferences'

export default async function Page(props: {
    params: Promise<{ id: string[] }>
    searchParams: Promise<{ file?: string }>
}) {
    const params = await props.params
    const searchParams = await props.searchParams
    const alias = params.id[0]
    const Cookies = await cookies()
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const { openFolders, openFiles, sharePageWidth, shareTerminalHeight } = readShareRoutePreferences(Cookies, 'project')
    const project = await getProject({ alias, token, userId })

    if (!project) {
        const share = await getShare({ id: alias, token, userId })
        if (typeof share !== 'string') {
            redirect(`/s/${alias}`)
        }
    }

    if (!project) {
        redirect(`/s/${alias}`)
    }

    const activeShare = searchParams.file
        ? await getShare({ id: searchParams.file, token, userId })
        : null

    return (
        <div className='w-full h-[92.5vh]'>
            <SharePageClient
                id={project.share.id}
                share={typeof activeShare === 'string' || !activeShare ? project.share : activeShare}
                openFolders={openFolders}
                tree={project.tree}
                sharePageWidth={sharePageWidth}
                shareTerminalHeight={shareTerminalHeight}
                serverOpenFiles={openFiles}
                autoCreate={false}
                initialChatOpen={false}
                replaceUrlOnCreate={false}
            />
        </div>
    )
}
