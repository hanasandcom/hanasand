import {
    PUBLIC_TI_HANDOFF_ACTIONS,
    PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
    buildActorArtifactHandoffs,
    decodePublicTiHandoffFromUrl,
    decodePublicTiHandoffPayload,
    encodeHandoffPayload,
    nextActorArtifactId,
    validatePublicTiHandoffPayload,
} from '../../../src/utils/ti/actorWorkbench'
import { assert } from '../assert'
import { actionability, artifacts, fixture } from '../runtimeContext'

assert(artifacts.some(item => item.kind === 'country' && item.label === 'United States' && item.watchlistTerms.some(term => /SolarWinds/i.test(term.value))), 'APT29 artifact workbench should turn geography into watchlist-relevant evidence.')
assert(artifacts.some(item => item.kind === 'country' && item.label === 'United States' && item.provenance.some(row => /source cisa/i.test(row)) && item.evidence.some(row => /2020/.test(row))), 'APT29 country artifacts should carry source IDs and report dates into the selected workbench.')
assert(!artifacts.some(item => item.kind === 'tool'), 'Artifact workbench must not invent malware/tool artifacts.')
assert(artifacts.some(item => item.kind === 'campaign' && /Microsoft disclosed/i.test(item.label)), 'Artifact workbench should expose captured campaign artifacts.')
const usArtifact = artifacts.find(item => item.kind === 'country' && item.label === 'United States')
assert(usArtifact?.provenance.length, 'Selected artifact should expose provenance.')
const usHandoffs = usArtifact ? buildActorArtifactHandoffs(fixture, usArtifact, actionability) : null
assert(usHandoffs?.watchlist.body.selectedArtifact, 'Selected artifact watchlist handoff should carry selectedArtifact context.')
assert(JSON.stringify(usHandoffs?.case.body).includes('selectedArtifact'), 'Selected artifact case handoff should carry selectedArtifact context.')
assert(JSON.stringify(usHandoffs?.enrichment.body).includes('United States'), 'Selected artifact enrichment handoff should carry artifact-specific task context.')
assert(usArtifact?.readiness.state === 'stale', 'APT29 fixture should gate stale artifact evidence instead of claiming alert-ready status.')
assert(usHandoffs?.authBridge.schemaVersion === 'ti.public_actor.authenticated_bridge.v1', 'Selected artifact should export an authenticated bridge contract.')
assert(usHandoffs?.authBridge.orgRequired, 'Public artifact handoff should keep organization scope explicit.')
assert(usHandoffs?.authBridge.stale, 'Authenticated bridge should carry stale evidence state.')
assert(usHandoffs?.authBridge.links.watchlist.href.includes('/findings?handoff=public-ti'), 'Watchlist bridge should deep-link into the authenticated dashboard.')
assert(usHandoffs?.authBridge.links.watchlist.intent === PUBLIC_TI_HANDOFF_ACTIONS.watchlist, 'Watchlist bridge should use a stable action name.')
assert(usHandoffs?.authBridge.payload.schemaVersion === PUBLIC_TI_HANDOFF_SCHEMA_VERSION, 'Default bridge payload should carry the exported schema version.')
assert(usHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case].selectedPayload.route === 'case', 'Case bridge payload should select the case export payload.')
assert(usHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild].selectedPayload.route === 'alert_rebuild', 'Alert bridge payload should select the alert rebuild export payload.')
assert(usHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case].missing.some(item => /DWM alert ID/i.test(item)), 'Artifact case readiness should expose the alert dependency.')
assert(usHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild].missing.some(item => /organization/i.test(item)), 'Artifact alert rebuild readiness should expose the organization dependency.')
const decodedWatchlist = usHandoffs ? decodePublicTiHandoffFromUrl(usHandoffs.authBridge.links.watchlist.href) : null
assert(decodedWatchlist?.ok, 'Watchlist deep-link payload should decode through the exported contract parser.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.artifact.label === 'United States', 'Deep-link payload should decode selected artifact context.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist, 'Decoded watchlist payload should preserve the action.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.orgRequired, 'Decoded APT29 payload should keep org-required blocker state.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.sourceRequired, 'Decoded APT29 payload should keep source-required blocker state.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.stale, 'Decoded APT29 payload should keep stale-evidence blocker state.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.blockers.some(blocker => blocker.code === 'stale_evidence'), 'Decoded APT29 payload should carry stable blocker codes.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.sourceRequests.some(source => source.missing.includes('captureId or source request ID')), 'Decoded APT29 payload should expose missing capture/source request IDs.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.sourceRequests.every(source => source.ownerLane === 'source' && source.route === '/ti/profiles' && source.sourceFamily === 'source_capture'), 'Decoded APT29 source requests should carry source owner, route, and family.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.sourceRequests.some(source => source.requestedFields?.includes('sourceProvenance[].captureId') && source.requestedFields?.includes('sourceProvenance[].sourceRequestId')), 'Decoded APT29 source requests should carry requested source/capture fields.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.actionReadiness.length === 4, 'Decoded APT29 payload should expose per-action readiness for watchlist, alert, case, and enrichment.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.actionReadiness.some(item => item.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist && item.selected && item.ownerLane === 'org' && item.blockerCodes.includes('org_required')), 'Decoded APT29 watchlist readiness should carry selected action, org owner, and blocker code.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.actionReadiness.some(item => item.action === PUBLIC_TI_HANDOFF_ACTIONS.case && item.endpoint === '/v1/cases' && item.blockerCodes.includes('stale_evidence')), 'Decoded APT29 case readiness should carry case endpoint and stale-evidence blocker.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.actionReadiness.every(item => typeof item.sourceRequestCount === 'number' && item.sourceRequestCount === decodedWatchlist.payload.sourceRequests.length), 'Decoded APT29 action readiness should carry source request counts for dashboard consumers.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.evidenceRefs?.captureIds.length === 0, 'Decoded APT29 payload should not invent capture IDs when source captures are missing.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.evidenceRefs?.watchlistTerms.some(term => term === 'company:Microsoft'), 'Decoded APT29 payload should carry selected watchlist terms as evidence refs.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.evidenceRefs?.endpoints.includes('/v1/cases'), 'Decoded APT29 payload should carry case endpoint refs for downstream consumers.')
const legacyDecoded = usHandoffs ? decodePublicTiHandoffPayload(encodeHandoffPayload({
    artifact: usHandoffs.authBridge.payload.artifact,
    watchlist: usHandoffs.watchlist,
    alertRebuild: usHandoffs.alertRebuild,
    case: usHandoffs.case,
    enrichment: usHandoffs.enrichment,
}), 'watchlist') : null
assert(legacyDecoded?.ok && legacyDecoded.payload.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist, 'Legacy bridge payloads should migrate to the stable watchlist action.')
const missingPayload = decodePublicTiHandoffPayload(null)
assert(!missingPayload.ok && missingPayload.code === 'missing_payload', 'Decoder should return missing_payload for absent payloads.')
const malformedPayload = decodePublicTiHandoffPayload('%7Bbad', 'watchlist')
assert(!malformedPayload.ok && malformedPayload.code === 'malformed_json', 'Decoder should return malformed_json for bad JSON.')
assert(validatePublicTiHandoffPayload({ schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION, action: 'unknown', query: 'apt29', artifact: {} }).ok === false, 'Validator should reject unsupported actions.')
assert(validatePublicTiHandoffPayload({ schemaVersion: 'ti.public_actor.authenticated_bridge.v0', action: PUBLIC_TI_HANDOFF_ACTIONS.watchlist }).ok === false, 'Validator should reject unsupported schema versions.')
assert(JSON.parse(decodeURIComponent(encodeHandoffPayload({ artifactId: 'artifact:test' }))).artifactId === 'artifact:test', 'Handoff payload encoding should round-trip.')
assert(nextActorArtifactId(artifacts, artifacts[0]?.id, 'next') === artifacts[1]?.id, 'Keyboard helper should move to next artifact.')
assert(nextActorArtifactId(artifacts, artifacts[0]?.id, 'previous') === artifacts[artifacts.length - 1]?.id, 'Keyboard helper should wrap to previous artifact.')
