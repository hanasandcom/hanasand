import { describe, expect, it } from 'bun:test'
import { isMailReputationClear } from '../src/mail/reputation.js'

describe('Mail VirusTotal release policy', () => {
    it('allows content only when VirusTotal reports known and zero flagged', () => {
        expect(isMailReputationClear({ provider: 'virustotal', status: 'known', flagged: 0, total: 90 })).toBe(true)
        expect(isMailReputationClear({ provider: 'virustotal', status: 'known', flagged: 1, total: 90 })).toBe(false)
        expect(isMailReputationClear({ provider: 'virustotal', status: 'known', total: 90 })).toBe(false)
        expect(isMailReputationClear({ provider: 'virustotal', status: 'unknown' })).toBe(false)
        expect(isMailReputationClear({ provider: 'virustotal', status: 'unavailable' })).toBe(false)
        expect(isMailReputationClear(undefined)).toBe(false)
    })
})
