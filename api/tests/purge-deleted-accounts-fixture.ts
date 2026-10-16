import './purge-deleted-accounts-mocks.ts'
import { resetState, state } from './purge-deleted-accounts-state.ts'

const { purgeDeletedAccount, purgeDeletedAccounts } = await import('../src/utils/auth/purgeDeletedAccounts.ts')
const { default: restoreSelf } = await import('../src/handlers/user/restoreSelf.ts')

export { purgeDeletedAccount, purgeDeletedAccounts, resetState, state }

export async function callRestore(restoreToken: string) {
    const response: { statusCode: number, body?: unknown } = { statusCode: 200 }
    const reply = {
        status(statusCode: number) { response.statusCode = statusCode; return reply },
        send(body: unknown) { response.body = body; return reply },
    }
    await restoreSelf({ body: { id: 'deleted-user', restoreToken }, ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any, reply as any)
    return response
}
