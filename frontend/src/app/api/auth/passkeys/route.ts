import { proxyAuthenticatedPasskeyRequest } from './proxyJsonResponse'

export async function GET() {
    return proxyAuthenticatedPasskeyRequest('')
}
