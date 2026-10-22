import { createServer } from 'node:http'

const token = 'vm-stage-token-only'
const user = { id: 'vm-stage-user', name: 'VM Stage User', avatar: '', active: true }
const organization = { id: 'vm-stage-cashflow', name: 'Cashflow Staging', slug: 'cashflow-staging', role: 'owner', lifecycleStatus: 'active' }

createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    if (request.method === 'GET' && url.pathname.startsWith('/api/auth/token/')) {
        const id = decodeURIComponent(url.pathname.slice('/api/auth/token/'.length))
        if (request.headers.authorization !== `Bearer ${token}` || id !== user.id) {
            response.writeHead(401).end()
            return
        }
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ token, name: user.name, avatar: user.avatar, expires_at: new Date(Date.now() + 60 * 60_000).toISOString() }))
        return
    }
    if (request.method === 'GET' && url.pathname === '/api/organizations') {
        if (request.headers.authorization !== `Bearer ${token}` || request.headers.id !== user.id) {
            response.writeHead(401).end()
            return
        }
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ organizations: [organization] }))
        return
    }
    if (request.method !== 'POST' || request.url !== '/api/auth/internal/sessions') {
        response.writeHead(404).end()
        return
    }

    let body = ''
    for await (const chunk of request) body += chunk
    const input = JSON.parse(body || '{}')
    if (request.headers.authorization !== 'Bearer vm-stage-identity-only') {
        response.writeHead(401).end()
        return
    }

    const now = new Date().toISOString()
    const session = {
        token_id: 1,
        id: user.id,
        token,
        ip: '127.0.0.1',
        user_agent: 'Hanasand local VM staging',
        created_at: now,
        timestamp: now,
    }

    if (input.operation === 'validate' && input.id === user.id && input.token === token) {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
            user,
            session,
            organizationMember: true,
            organizationMembership: { organizationId: 'vm-stage-cashflow', organizationStatus: 'active', membershipStatus: 'active', role: 'owner' },
            refreshed: { token, expires_at: new Date(Date.now() + 60 * 60_000).toISOString() },
        }))
        return
    }

    if (input.operation === 'issue' && input.id === user.id) {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ token, expires_at: new Date(Date.now() + 60 * 60_000).toISOString() }))
        return
    }

    if (input.operation === 'list' && input.id === user.id) {
        response.writeHead(200, { 'content-type': 'application/json' }).end('[]')
        return
    }

    if (input.operation === 'revoke' || input.operation === 'revoke-all') {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(input.operation === 'revoke' ? { revoked: true } : { revoked: 0 }))
        return
    }

    response.writeHead(401).end()
}).listen(8081, '0.0.0.0')
