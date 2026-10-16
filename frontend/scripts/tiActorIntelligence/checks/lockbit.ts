import { assert } from '../assert'
import { lockbitProfile } from '../fixtures/lockbit'

assert(lockbitProfile.actorClass === 'Named threat actor or activity cluster', 'Actor class must stay generic without a sourced classification.')
assert(lockbitProfile.malwareTools.length === 0, 'Aliases must not be converted into malware/tool facts.')
assert(lockbitProfile.infrastructure.length === 0, 'Source names must not be converted into actor infrastructure.')
assert(lockbitProfile.campaigns.length > 0, 'Captured activity should remain available as campaign context.')
assert(lockbitProfile.confidenceReasoning.some(item => /source records/i.test(item)), 'Generic fallback should explain source-backed confidence.')
