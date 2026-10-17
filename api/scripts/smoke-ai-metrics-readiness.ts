import assert from 'node:assert/strict'
import { buildCommercialReadiness } from '../src/handlers/ai/economics.ts'
import { emptyReadinessInput, operationalReadinessInput } from './aiMetricsReadinessFixtures.ts'

const readiness = buildCommercialReadiness(operationalReadinessInput)
const deploymentGate = readiness.items.find(item => item.id === 'deployment_ownership')
assert.equal(deploymentGate?.status, 'operational')
assert.match(deploymentGate?.evidence.join(' ') || '', /1 deployment record/)
assert.match(deploymentGate?.evidence.join(' ') || '', /1 running/)
assert.doesNotMatch(deploymentGate?.evidence.join(' ') || '', /\b0 deployment records\b/)
assert.doesNotMatch(deploymentGate?.evidence.join(' ') || '', /\b0 .*usage window\b/)
assert.doesNotMatch(deploymentGate?.evidence.join(' ') || '', /\b0 (superseded|failed)\b/)
assert.match(deploymentGate?.lastAttempt || '', /deployment dep_1 is running/)

const designGate = readiness.items.find(item => item.id === 'design_quality')
assert.equal(designGate?.status, 'operational')
assert.match(designGate?.evidence.join(' ') || '', /Design QA worker fetches pages/)

const economicsGate = readiness.items.find(item => item.id === 'verified_outcome_economics')
assert.match(
    economicsGate?.evidence.join(' ') || '',
    /Key metric is verified useful project progress per minute per NOK, currently 0\.50 NOK per successful verified build or deploy check\./,
)

assertTruthfulReadinessCopy(readiness)

const emptyReadiness = buildCommercialReadiness(emptyReadinessInput)
assertNoStaleEmptyStateClaims(emptyReadiness)
for (const id of ['durable_async_verification', 'deployment_ownership', 'verified_outcome_economics', 'non_developer_ux', 'design_quality', 'model_routing_after_measurement']) {
    const item = emptyReadiness.items.find(candidate => candidate.id === id)
    assert.equal(item?.status, 'internal_action', `${id} should become an internal action when no real records exist.`)
    assert.ok(item?.owner && item.control && item.lastAttempt && item.action, `${id} must expose owner/control/last attempt/action.`)
}

console.log(`AI metrics readiness smoke passed for ${readiness.items.length} gates.`)

function assertTruthfulReadinessCopy(value: typeof readiness) {
    const renderedCopy = JSON.stringify(value)
    assert.doesNotMatch(renderedCopy, /Launch blockers|needs proof|needs work|The product is on the right path/i)
    assert.ok(value.items.every(item => item.owner && item.control && item.lastAttempt && item.action))
}

function assertNoStaleEmptyStateClaims(value: typeof readiness) {
    const renderedCopy = JSON.stringify(value)
    for (const staleZero of [/\b0 deployment records\b/i, /\b0 durable design QA jobs\b/i, /\b0 queued\b/i, /\b0 completed\b/i]) {
        assert.doesNotMatch(renderedCopy, staleZero)
    }
    assert.doesNotMatch(renderedCopy, /Launch blockers|needs proof|needs work|The product is on the right path/i)
}
