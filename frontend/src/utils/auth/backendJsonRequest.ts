import { setCookieWithExpiresAt } from 'hanasand/cookies'
import { backendRequestHeaders } from './backendRequestHeaders'

type Options = RequestInit & {
    errorMessage: string
    authenticated?: boolean
    refreshAccessToken?: boolean
}

export async function backendJsonRequest<T>(path: string, options: Options): Promise<T> {
    const { errorMessage, authenticated = true, refreshAccessToken = false, ...init } = options
    const response = await fetch(`/api/backend${path}`, {
        ...init,
        headers: authenticated ? backendRequestHeaders(init.headers) : init.headers,
    })
    if (refreshAccessToken) refreshToken(response)

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(String((body as { error?: string }).error || errorMessage))
    }
    return body as T
}

function refreshToken(response: Response) {
    const token = response.headers.get('x-access-token')
    if (!token) return
    setCookieWithExpiresAt('access_token', token, response.headers.get('x-access-token-expires-at'))
}
