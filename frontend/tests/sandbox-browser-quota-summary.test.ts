// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { runQuotaSummary } from '../src/app/sandbox/_browser/browser/historyData'
import { quotaValue } from '../src/app/sandbox/_browser/browser/browserValues'

test('does not show guest limits while the signed-in quota is loading', () => {
    expect(runQuotaSummary(null, 'loading')).toBe('Loading run limits')
    expect(runQuotaSummary(null, 'unavailable')).toBe('Run limits unavailable')
})

test('shows the unlimited limits returned for a signed-in free user', () => {
    const quota = quotaValue({
        plan: 'free', paid: false, advancedAnalysis: false, sessionSeconds: 90,
        concurrentLimit: null, active: 0, limit: null, used: 8, remaining: null,
        identityKind: 'user',
    })

    expect(runQuotaSummary(quota, 'ready')).toBe('1 min 30 sec per run · no simultaneous-browser limit · no daily run limit')
})

test('shows the daily guest cap once anonymous quota is loaded', () => {
    const quota = quotaValue({
        plan: 'anonymous', paid: false, advancedAnalysis: false, sessionSeconds: 90,
        concurrentLimit: 1, active: 0, limit: 20, used: 3, remaining: 17,
        identityKind: 'anonymous',
    })

    expect(runQuotaSummary(quota, 'ready')).toBe('1 min 30 sec per run · 1 simultaneous browser · 3/20 runs today')
})
