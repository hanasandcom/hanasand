import { NextRequest } from 'next/server'
import { proxyAuthenticatedPasskeyRequest } from '../../proxyJsonResponse'

export async function GET(req: NextRequest) {
    return proxyAuthenticatedPasskeyRequest(req, '/register/options')
}
