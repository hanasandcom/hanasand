import { expect, test } from 'bun:test'
import { profileHostKeyReconciliationPlan } from '../src/utils/hostSshKeys.ts'

test('active profile SSH keys are provisioned on both administrative hosts', () => {
    const keys = ['ssh-ed25519 AAAA profile-key']
    const revoked = ['ssh-ed25519 AAAA removed-key']

    expect(profileHostKeyReconciliationPlan(keys, revoked)).toEqual([
        { host: 'inspur', keys, revoke: revoked },
        { host: 'ovh', keys, revoke: revoked },
    ])
})
