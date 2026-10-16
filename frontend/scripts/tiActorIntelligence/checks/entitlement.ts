import { assert } from '../assert'
import { entitlementBlocked } from '../fixtures/entitlementBlocked'

assert(entitlementBlocked.readiness.blockers.some(blocker => blocker.code === 'entitlement_blocked' && blocker.ownerLane === 'entitlement' && blocker.source === 'entitlement_readiness'), 'Entitlement readiness should surface entitlement-owned blockers.')
assert(entitlementBlocked.readiness.blockers.some(blocker => blocker.code === 'entitlement_blocked' && blocker.source === 'delivery_readiness'), 'Delivery readiness entitlement denials should be preserved.')
