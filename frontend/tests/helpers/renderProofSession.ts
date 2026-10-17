import type { BrowserContext } from '@playwright/test'

const renderProofUser = 'dashboard-render-proof-user'
const renderProofToken = 'local-dashboard-render-proof-token'

export async function setupRenderProofSession(context: BrowserContext, baseURL?: string) {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: renderProofUser, url: origin },
        { name: 'access_token', value: renderProofToken, url: origin },
        { name: 'id', value: renderProofUser, domain: 'localhost', path: '/' },
        { name: 'access_token', value: renderProofToken, domain: 'localhost', path: '/' },
        { name: 'id', value: renderProofUser, domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: renderProofToken, domain: '127.0.0.1', path: '/' },
    ])
    return { userId: renderProofUser }
}
