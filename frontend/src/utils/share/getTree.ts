import config from '@/config'
import getShareHeaders from './getHeaders'
import withAbortTimeout from './withAbortTimeout'

type GetTreeProps = {
    id: string
    token?: string
    userId?: string
}

export async function getTree({ id, token, userId }: GetTreeProps): Promise<Tree | null> {
    try {
        return await withAbortTimeout(Math.max(config.abortTimeout, 10000), async signal => {
            const response = await fetch(`${config.url.api}/share/tree/${id}`, {
                headers: getShareHeaders(token, userId),
                cache: 'no-store',
                signal
            })

            if (response.status === 404 || response.status === 410) {
                return null
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch share tree for ${id}: ${response.status}`)
            }

            return response.json()
        })
    } catch (error) {
        console.warn(error)
        return null
    }
}
