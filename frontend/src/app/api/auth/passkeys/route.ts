import { NextRequest } from 'next/server'
import { proxyAuthenticatedPasskeyRequest } from './proxyJsonResponse'

export async function GET(request: NextRequest) {
    return proxyAuthenticatedPasskeyRequest(request, '')
}
