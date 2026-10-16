import { buildActorIntelligence } from '../../src/utils/ti/actorIntelligence'
import { actorGeoProfile, victimObservationsFor } from '../../src/utils/ti/actorProfile'
import { buildTiActionability } from '../../src/utils/ti/actionability'
import { buildActorArtifacts } from '../../src/utils/ti/actorWorkbench'
import { fixture, victims } from './fixtures/base'

export { fixture, victims }
export const profile = buildActorIntelligence(fixture, victims)
export const actionability = buildTiActionability(fixture, profile, victims)
export const artifacts = buildActorArtifacts(fixture, profile, victims, actionability)
export const fullPublicVictims = victimObservationsFor(fixture)
export const fullPublicProfile = buildActorIntelligence(fixture, fullPublicVictims)
export const fullPublicActionability = buildTiActionability(fixture, fullPublicProfile, fullPublicVictims)
export const geo = actorGeoProfile(fixture)
