import { expect, test } from 'bun:test'
import operationalStateLabel from '../src/utils/status/operationalStateLabel'

test('maps operational states to the same user-facing labels', () => {
    expect(operationalStateLabel('blocked')).toBe('syncing')
    expect(operationalStateLabel('needs_action')).toBe('reviewing')
    expect(operationalStateLabel('action_required')).toBe('reviewing')
    expect(operationalStateLabel('ready_to_run')).toBe('ready to run')
    expect(operationalStateLabel('ready')).toBe('ready')
})
