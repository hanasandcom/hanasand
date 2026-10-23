import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const testPage = readSource('src/app/test/page.tsx')
const testClient = readSource('src/app/test/pageClient.tsx')
const trafficShapes = readSource('src/utils/test/trafficShapes.ts')
const postTestClient = readSource('src/utils/test/postTest.ts')
const endpointCheckPanel = readSource('src/app/test/EndpointCheckPanel.tsx')
const loadTestingPage = readSource('src/app/dashboard/load-testing/page.tsx')
const loadTestingClient = readSource('src/app/dashboard/load-testing/pageClient.tsx')
const loadTestingLaunch = readSource('src/app/dashboard/load-testing/LoadTestingLaunch.tsx')
const loadTestingSnapshot = readSource('src/app/dashboard/load-testing/LoadTestOperationsSnapshot.tsx')
const tiClient = readSource('src/app/ti/components/ti-page-client.tsx')
const tiControls = readSource('src/app/ti/components/search-workspace-controls.tsx')
const emptyState = readSource('src/app/ti/components/empty-state.tsx')

assertIncludes(endpointCheckPanel, 'Check a service before users do', 'public service check page must lead with the primary workflow')
assertIncludes(endpointCheckPanel, 'Try your endpoint with some traffic and see how it holds up.', 'public service check page must explain the test in plain language')
assertExcludes(endpointCheckPanel, 'owned HTTP endpoint', 'public service check page must avoid ownership-focused technical copy')
assertIncludes(testPage, 'lg:grid-cols-[0.9fr_1.1fr] lg:items-center', 'public service check layout must match the compact two-column split')
assertIncludes(endpointCheckPanel, 'Start test', 'public service check launcher must be one focused panel')
assert.match(testClient, /import\s+\{[^}]*\bscenarioPresets\b[^}]*\}\s+from '@\/utils\/test\/trafficShapes'/, 'public service check page must import the shared traffic presets')
assertIncludes(trafficShapes, 'export const scenarioPresets = [', 'traffic shape module must export the shared presets')
for (const preset of ['baseline', 'ramp', 'spike', 'custom']) {
    assertIncludes(trafficShapes, `id: '${preset}'`, `shared traffic shapes must include the ${preset} preset`)
}
assertIncludes(testClient, 'scenarios={scenarioPresets}', 'public service check page must supply shared presets to the scenario picker')
assertIncludes(testClient, 'onScenarioChange={setScenarioId}', 'public service check page must retain the selected scenario')
assertIncludes(endpointCheckPanel, 'scenarios.map((scenario) => (', 'scenario picker must render every shared preset')
assertIncludes(endpointCheckPanel, '{scenario.label}', 'public service check page must show the traffic shape names')
assertIncludes(endpointCheckPanel, 'onScenarioChange(scenario.id)', 'scenario picker must select the clicked preset')
assertIncludes(testClient, 'scenarioPresets.find((scenario) => scenario.id === scenarioId)', 'launcher must resolve the selected shared preset')
assertIncludes(testClient, 'selectedPreset.id === \'custom\' ? toK6Stages(customStages) : selectedPreset.stages', 'launcher must preserve custom and preset traffic stages')
assertJobPayload(testClient, 'url', 'selectedScenario', 'public service check launcher')
assertIncludes(postTestClient, 'body: JSON.stringify({ url, timeout, stages })', 'job API request must preserve the selected endpoint, timeout and stages')
assertIncludes(endpointCheckPanel, 'Recent checks', 'public service check page must keep shared result history in the main panel')
assertIncludes(endpointCheckPanel, 'My checks', 'public service check page must keep personal history as a small action')
assertExcludes(testClient, 'RecentScans title=', 'public service check page must not restore stacked history cards')
assertExcludes(testClient, 'Service check launcher', 'public service check page must not use the old small-column launcher copy')
assertExcludes(testClient, 'Latest permitted checks across the service', 'public service check page must not imply legitimacy monitoring')
assertExcludes(testClient, 'lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)_minmax(12rem,16rem)]', 'public service check page must not regress to the narrow side-column layout')

assertIncludes(testPage, 'min-h-app-viewport', 'public service check page shell must allow the redesigned workflow to scroll')
assertExcludes(testPage, 'h-app-viewport overflow-hidden', 'public service check shell must not clip the redesigned workflow')

assertIncludes(loadTestingPage, '<LoadTestingOperations />', 'dashboard service check route must render the operations command center before secondary tables')
assertOrder(loadTestingPage, '<LoadTestingOperations />', '<DashboardPanel className=\'overflow-hidden p-0\'>', 'dashboard operations command center must appear before allowance lanes')

assertIncludes(loadTestingLaunch, 'Check an endpoint you control', 'dashboard command center must lead with the service-check workflow')
assertIncludes(loadTestingClient, 'fetchRecentTests', 'dashboard command center must read actual recent check history')
assertIncludes(loadTestingLaunch, 'latestP95(props.latestScan)', 'dashboard command center must derive latency evidence from recent run data')
assertIncludes(loadTestingClient, 'loadTestStatusCounts(allScans)', 'dashboard command center must count failures from the same deduplicated recent run data shown in its history')
assertIncludes(loadTestingClient, 'failedCount={failedCount}', 'dashboard command center must pass the derived failure count into its launch snapshot')
assertIncludes(loadTestingLaunch, 'failedCount={props.failedCount}', 'dashboard command center must forward the failure count into its visible snapshot')
assertIncludes(loadTestingSnapshot, 'label=\'Failures\' value={failedCount ? String(failedCount) : \'Clear\'}', 'dashboard command center must expose the failure count or clear state to operators')
assertJobPayload(loadTestingClient, 'url: targetUrl', 'scenario', 'dashboard command center')
assertIncludes(loadTestingLaunch, 'p95/p99 evidence', 'dashboard command center must surface latency evidence, not a vague launch promise')
assertIncludes(loadTestingSnapshot, 'logs + share link', 'dashboard command center must surface artifact evidence')
assertExcludes(loadTestingClient, 'Next: run more jobs', 'dashboard command center must not ship next-action placeholder copy')
assertExcludes(loadTestingClient, 'needs proof', 'dashboard command center must not ship blocker-style placeholder copy')
assertExcludes(loadTestingClient, 'needs work', 'dashboard command center must not ship blocker-style placeholder copy')

const searchFormStart = tiControls.indexOf('<form onSubmit={onSubmit}')
const resultsGate = tiClient.indexOf('{busy ? <SearchLoading')
assert.ok(searchFormStart >= 0, 'TI search controls were not found')
assert.ok(resultsGate >= 0, 'TI page result visibility gate was not found')
const landingForm = tiControls.slice(searchFormStart)

assertIncludes(landingForm, 'Search threat intelligence', 'TI landing must use a concise search-focused heading')
assertIncludes(landingForm, 'Find current intelligence about any threat actor, company, domain, CVE, or malware family.', 'TI landing must use one short blue helper line')
assertIncludes(tiClient, 'max-w-[45rem] place-content-center gap-5 py-10', 'TI landing must center the search workflow before a result exists')
assertIncludes(emptyState, 'APT29', 'TI empty state may keep compact query chips')
assertIncludes(emptyState, 'LockBit', 'TI empty state may keep compact query chips')
assertIncludes(emptyState, 'microsoft.com', 'TI empty state may keep compact query chips')
assertExcludes(emptyState, 'Threat intelligence workspace', 'TI empty state must not restore the old text-heavy workspace copy')
assertExcludes(emptyState, 'Investigation view', 'TI empty state must not restore the old text-heavy workspace copy')
assertExcludes(emptyState, 'Handoff status', 'TI empty state must not restore the old text-heavy workspace copy')
assertExcludes(emptyState, 'Source coverage', 'TI empty state must not restore the old text-heavy workspace copy')

console.log('[service-check-ti-landing] service check and TI landing UX guard passed')

function readSource(relativePath) {
    return readFileSync(path.join(root, relativePath), 'utf8')
}

function assertIncludes(source, needle, message) {
    assert.ok(source.includes(needle), `${message}: missing ${JSON.stringify(needle)}`)
}

function assertExcludes(source, needle, message) {
    assert.equal(source.includes(needle), false, `${message}: found ${JSON.stringify(needle)}`)
}

function assertJobPayload(source, endpoint, scenario, message) {
    const payload = source.match(/postTest\(\{([^}]*)\}\)/)?.[1]
    const fields = payload?.split(',').map(field => field.trim()) || []
    for (const field of [endpoint, `timeout: ${scenario}.timeout`, `stages: ${scenario}.stages`]) {
        assert.ok(fields.includes(field), `${message} must send ${field} to the job API`)
    }
}

function assertOrder(source, first, second, message) {
    const firstIndex = source.indexOf(first)
    const secondIndex = source.indexOf(second)
    assert.ok(firstIndex >= 0, `${message}: missing first token ${JSON.stringify(first)}`)
    assert.ok(secondIndex >= 0, `${message}: missing second token ${JSON.stringify(second)}`)
    assert.ok(firstIndex < secondIndex, `${message}: expected ${JSON.stringify(first)} before ${JSON.stringify(second)}`)
}
