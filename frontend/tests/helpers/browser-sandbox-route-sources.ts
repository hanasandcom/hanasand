import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { readBrowserClientSource } from './browser-client-source'

const root = process.cwd()
const readSource = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')
const clientSource = readBrowserClientSource(root)

export const browserSandboxRouteSources = {
    root,
    routeSource: readSource('src/app/sandbox/page.tsx'),
    browserAliasSource: readSource('src/app/browser/page.tsx'),
    clientSource,
    legacyBrowserSource: readSource('src/app/browser-sandbox/page.tsx'),
    legacyOnionSource: readSource('src/app/solutions/onion-session/page.tsx'),
    wsSource: readSource('../api/src/plugins/ws.ts'),
    brokerSource: readSource('../api/src/handlers/onionSession/ws.ts'),
    providerCaptureSource: readSource('../api/src/handlers/onionSession/providerCapture.ts'),
    networkTelemetrySource: readSource('../api/src/handlers/onionSession/networkTelemetry.ts'),
    downloadsSource: readSource('../api/src/handlers/onionSession/downloads.ts'),
    admissionSource: readSource('../api/src/utils/ws/browserAdmission.ts'),
    runsSource: readSource('../api/src/handlers/browserSandboxRuns.ts'),
    routesSource: readSource('../api/src/routes.ts'),
    browserProfileRoutesSource: readSource('../api/src/routes/browserSandboxProfiles.ts'),
    analysisSource: readSource('../api/src/handlers/onionSession/analysis.ts'),
    workerDockerSource: readSource('../api/Dockerfile'),
    browserReconnectSource: readSource('../api/src/utils/ws/browserReconnect.ts'),
    analystSummarySource: readSource('src/app/browser/browserAnalystSummary.ts'),
    stopRunSource: clientSource.slice(clientSource.indexOf('const stopRun'), clientSource.indexOf('const resetRun')),
    socketErrorSource: clientSource.slice(clientSource.indexOf('socket.onerror'), clientSource.indexOf('socket.onmessage')),
    fixtureExists(relativePath: string) {
        return existsSync(path.join(root, relativePath))
    },
}
