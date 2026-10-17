import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { readBrowserClientSource } from './browser-client-source'

const root = process.cwd()
const readSource = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')
const readTypeScriptTree = (relativePath: string) => readdirSync(path.join(root, relativePath), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap(entry => entry.isDirectory()
        ? [readTypeScriptTree(`${relativePath}/${entry.name}`)]
        : entry.isFile() && entry.name.endsWith('.ts')
            ? [readSource(`${relativePath}/${entry.name}`)]
            : [])
    .join('\n')
const clientSource = readBrowserClientSource(root)
const browserRunSources = readdirSync(path.join(root, '../api/src/handlers'))
    .filter(file => /^browserSandboxRun.*\.ts$/.test(file))
    .sort()
    .map(file => readSource(`../api/src/handlers/${file}`))
    .join('\n')
const wsSource = [
    readSource('../api/src/plugins/ws.ts'),
    readTypeScriptTree('../api/src/plugins/ws'),
].join('\n')
const brokerSource = readTypeScriptTree('../api/src/handlers/onionSession')

export const browserSandboxRouteSources = {
    root,
    routeSource: readSource('src/app/sandbox/page.tsx'),
    browserAliasSource: readSource('src/app/browser/page.tsx'),
    clientSource,
    legacyBrowserSource: readSource('src/app/browser-sandbox/page.tsx'),
    legacyOnionSource: readSource('src/app/solutions/onion-session/page.tsx'),
    wsSource,
    brokerSource,
    providerCaptureSource: readSource('../api/src/handlers/onionSession/providerCapture.ts'),
    networkTelemetrySource: readSource('../api/src/handlers/onionSession/networkTelemetry.ts'),
    downloadsSource: readSource('../api/src/handlers/onionSession/downloads.ts'),
    admissionSource: readSource('../api/src/utils/ws/browserAdmission.ts'),
    runsSource: browserRunSources,
    routesSource: readSource('../api/src/routes/userContent.ts'),
    browserProfileRoutesSource: readSource('../api/src/routes/browserSandboxProfiles.ts'),
    analysisSource: [
        readSource('../api/src/handlers/onionSession/analysis.ts'),
        readTypeScriptTree('../api/src/handlers/onionSession/analysis'),
    ].join('\n'),
    workerDockerSource: readSource('../api/Dockerfile'),
    browserReconnectSource: readSource('../api/src/utils/ws/browserReconnect.ts'),
    analystSummarySource: readSource('src/app/browser/browserAnalystSummary.ts'),
    stopRunSource: clientSource.slice(clientSource.indexOf('const stopRun'), clientSource.indexOf('const resetRun')),
    socketErrorSource: clientSource.slice(clientSource.indexOf('socket.onerror'), clientSource.indexOf('socket.onmessage')),
    fixtureExists(relativePath: string) {
        return existsSync(path.join(root, relativePath))
    },
}
