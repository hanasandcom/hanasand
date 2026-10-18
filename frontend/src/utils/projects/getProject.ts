import config from '@/config'
import getShareHeaders from '@/utils/share/getHeaders'
import withAbortTimeout from '@/utils/share/withAbortTimeout'

type GetProjectProps = {
    alias: string
    token?: string
    userId?: string
}

type ProjectWorkspace = {
    tree: Tree
    share: Share
}

export default async function getProject({ alias, token, userId }: GetProjectProps): Promise<ProjectWorkspace | null> {
    try {
        const response = await withAbortTimeout(Math.max(config.abortTimeout, 10000), signal => fetch(`${config.url.api}/project/${alias}`, {
            headers: getShareHeaders(token, userId),
            signal,
        }))
        if (!response.ok) {
            return null
        }

        const data = await response.json()
        if (!data || !Array.isArray(data.tree) || !data.share) {
            return null
        }

        return data
    } catch (error) {
        console.error(`Failed to fetch project ${alias}: ${error}`)
        return null
    }
}
