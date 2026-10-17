import { orgId } from './state.ts'

export function printSummary(destinationId: string) {
    console.log(JSON.stringify({
        ok: true,
        destinationId,
        orgId,
        checked: [
            'discord payload context',
            'encrypted destination persistence',
            'dry-run test delivery',
            'destination last test result',
            'replay adapter org/watchlist mapping',
            'replay delivery',
            'live-disabled safety gate',
            'delivery hashes and attemptedAt',
            'delivery evidence filters',
            'delivery evidence redaction',
            'delivery evidence visibility policy',
            'delivery evidence replay/live/dry-run states',
            'destination contract fields and audit ids',
            'dry-run Discord preview fields',
            'watchlist/route/case context',
            'org-shared destination list',
            'structured audit events',
            'secret redaction',
        ],
        integrationChecklist: [
            'Command: cd api && /Users/eirikhanasand/.bun/bin/bun scripts/smoke-dwm-webhooks.ts',
            'Postgres reachable at DB_HOST/DB_PORT and migrations can run ensureSchema().',
            'Local default used by this repo: DB_HOST=127.0.0.1 DB_PORT=8503 when integration Postgres is exposed there.',
            'DWM_WEBHOOK_LIVE_DELIVERY is unset or false for dry-run verification.',
            'Set DWM_WEBHOOK_LIVE_DELIVERY=true only for deliberate live-send Discord tests.',
            'No external network is required for this smoke while live delivery is disabled.',
        ],
    }, null, 2))
}
