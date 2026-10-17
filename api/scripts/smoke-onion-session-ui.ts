import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '../..')
const frontendRoot = path.join(root, 'frontend')

const browserRoute = readFileSync(path.join(frontendRoot, 'src/app/browser/page.tsx'), 'utf8')
const sandboxRoute = readFileSync(path.join(frontendRoot, 'src/app/sandbox/page.tsx'), 'utf8')
const browserClient = readFileSync(path.join(frontendRoot, 'src/app/browser/pageClient.tsx'), 'utf8')
const browserTypes = readFileSync(path.join(frontendRoot, 'src/app/browser/types/session.ts'), 'utf8')
const browserValues = readFileSync(path.join(frontendRoot, 'src/app/browser/browserValues.ts'), 'utf8')
const browserLanding = readFileSync(path.join(frontendRoot, 'src/app/browser/components/BrowserLanding.tsx'), 'utf8')
const browserWorkspace = readFileSync(path.join(frontendRoot, 'src/app/browser/components/BrowserWorkspace.tsx'), 'utf8')
const viewportInput = readFileSync(path.join(frontendRoot, 'src/app/browser/components/useBrowserViewportInput.tsx'), 'utf8')
const evidenceWorkspace = readFileSync(path.join(frontendRoot, 'src/app/browser/components/EvidenceWorkspace.tsx'), 'utf8')
const historyPanel = readFileSync(path.join(frontendRoot, 'src/app/browser/components/RunHistoryPanel.tsx'), 'utf8')
const browserHistory = readFileSync(path.join(frontendRoot, 'src/app/browser/BrowserHistory.tsx'), 'utf8')
const legacyOnionRoute = readFileSync(path.join(frontendRoot, 'src/app/solutions/onion-session/page.tsx'), 'utf8')
const legacyRegularRoute = readFileSync(path.join(frontendRoot, 'src/app/browser-sandbox/page.tsx'), 'utf8')
const wsPlugin = [
    readFileSync(path.join(root, 'api/src/plugins/ws.ts'), 'utf8'),
    readFileSync(path.join(root, 'api/src/plugins/ws/sessionRoutes.ts'), 'utf8'),
].join('\n')
const broker = readFileSync(path.join(root, 'api/src/handlers/onionSession/ws.ts'), 'utf8')
const startup = readFileSync(path.join(root, 'api/src/handlers/onionSession/browserStartup.ts'), 'utf8')

assert(browserRoute.includes('redirect(\'/sandbox\')'))
assert(sandboxRoute.includes('path: \'/sandbox\''))
assert(sandboxRoute.includes('<BrowserPageClient initialData={initialData} />'))
assert(legacyOnionRoute.includes('redirect(\'/sandbox\')'))
assert(legacyRegularRoute.includes('redirect(\'/sandbox\')'))

assert(browserClient.includes('BrowserLanding'))
assert(browserTypes.includes('BrowserNetwork'))
assert(browserValues.includes('inferNetwork'))
assert(browserTypes.includes('BrowserFingerprint'))
assert(browserLanding.includes('SlidersHorizontal'))
assert(browserLanding.includes('id=\'sandbox-url\''))
assert(browserWorkspace.includes('Interactive isolated browser viewport'))
assert(viewportInput.includes('type: \'click\''))
assert(viewportInput.includes('type: \'wheel\''))
assert(viewportInput.includes('type: \'key\''))
assert(viewportInput.includes('type: \'clipboard\''))
assert(evidenceWorkspace.includes('Console logs'))
assert(historyPanel.includes('function HistoryPanel') || browserLanding.includes('HistoryPanel'))
assert(browserHistory.includes('/api/backend/browser/runs'))

assert(wsPlugin.includes('/api/ws/browser/:id'))
assert(startup.includes('requestBrowserAdmission(sessionId, send)'))
assert(!broker.includes('network === \'regular\' ? requestBrowserAdmission'))

console.log(JSON.stringify({
    ok: true,
    route: '/sandbox',
    aliasesRedirect: ['/browser', '/solutions/onion-session', '/browser-sandbox'],
    unifiedViewport: true,
    sharedQueue: true,
}, null, 2))
