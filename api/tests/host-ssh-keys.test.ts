import { expect, test } from 'bun:test'
import { profileHostKeyReconciliationPlan } from '../src/utils/hostSshKeys.ts'

test('profile SSH keys stay on OVH and are removed from Inspur', () => {
    const keys = ['ssh-ed25519 AAAA profile-key']

    expect(profileHostKeyReconciliationPlan(keys)).toEqual([
        { host: 'ovh', keys, revoke: keys },
        { host: 'inspur', keys: [], revoke: keys },
    ])
})
