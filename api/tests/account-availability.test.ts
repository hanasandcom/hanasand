import { describe, expect, test } from 'bun:test'
import { isAccountAvailable, isAccountUnavailable } from '../src/utils/accountAvailability.ts'

describe('account availability', () => {
    test('treats active accounts without lifecycle markers as available', () => {
        for (const account of [{ active: true }, { active: true, deactivated_at: null, deletion_scheduled_at: null }]) {
            expect(isAccountAvailable(account)).toBe(true)
            expect(isAccountUnavailable(account)).toBe(false)
        }
    })

    test('treats deactivated and scheduled-deletion accounts as unavailable', () => {
        const unavailableAccounts = [
            { active: false },
            { active: true, deactivated_at: '2026-10-16T00:00:00Z' },
            { active: true, deletion_scheduled_at: '2026-11-15T00:00:00Z' },
        ]

        for (const account of unavailableAccounts) {
            expect(isAccountUnavailable(account)).toBe(true)
            expect(isAccountAvailable(account)).toBe(false)
        }
    })
})
