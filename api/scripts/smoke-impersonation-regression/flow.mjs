import { cleanupSmoke } from './fixture.mjs'
import { checkAuditEvents } from './audit-events.mjs'
import { checkRejectedStarts } from './rejected-starts.mjs'
import { checkSessionAccess } from './session-access.mjs'
import { setupActors } from './setup.mjs'
import { startSession } from './start-session.mjs'
import { stopSession } from './stop-session.mjs'

const checks = [
    'admin-only start',
    'required reason and scoped duration',
    'visible audit link and scoped permissions',
    'missing/inactive/self targets',
    'legacy target header ignored',
    'opaque hashed session storage',
    'actor/target response headers',
    'sensitive action guardrail',
    'audit events',
    'audit filters',
    'structured admin audit feed',
    'stop and revoked-token rejection',
]

export async function runImpersonationRegression(context, api) {
    await cleanupSmoke(context)
    const tokens = await setupActors(context, api)
    await checkRejectedStarts(context, api, tokens)
    const session = await startSession(context, api, tokens.adminToken)
    await checkSessionAccess(context, api, tokens.adminToken, session.token)
    await checkAuditEvents(context, api, tokens.adminToken, session)
    await stopSession(context, api, tokens.adminToken, session)

    console.log(JSON.stringify({ ok: true, actor: context.adminId, target: context.targetId, checked: checks }, null, 2))
}
