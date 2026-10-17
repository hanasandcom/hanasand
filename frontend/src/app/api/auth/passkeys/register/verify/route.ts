import { NextRequest } from 'next/server'
import { proxyAuthenticatedPasskeyRequest } from '../../proxyJsonResponse'

export async function POST(req: NextRequest) {
    return proxyAuthenticatedPasskeyRequest('/register/verify', { method: 'POST', body: await req.text() })
}
