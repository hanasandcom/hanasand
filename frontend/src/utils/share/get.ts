import config from '@/config'
import getShareHeaders from './getHeaders'
import withAbortTimeout from './withAbortTimeout'

type GetShareProps = {
    id: string
    token?: string
    userId?: string
}

export async function getShare({ id, token, userId }: GetShareProps): Promise<Share | string> {
    try {
        return await withAbortTimeout(Math.max(config.abortTimeout, 10000), async signal => {
            const response = await fetch(`${config.url.api}/share/${id}`, {
                headers: getShareHeaders(token, userId),
                cache: 'no-store',
                signal
            })

            if (response.status === 404 || response.status === 410) {
                return `Share ${id} not found.`
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch share ${id}: ${response.status}`)
            }

            return response.json()
        })
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.warn('Request aborted (timeout reached)')
            return 'Unable to load share.'
        }

        console.warn(error)
        return `Share ${id} not found.`
    }
}
