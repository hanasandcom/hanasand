// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { exposureQueueFallback, normalizeExposureQueue } from '@/app/exposureQueue'
import { queueAfterFailedInitialCheck } from '@/app/homepageActivityFeedState'

test('empty exposure fallbacks keep real timestamps and explicit service state', () => {
    expect(exposureQueueFallback('checking', 10)).toMatchObject({ generatedAt: '', status: 'checking', items: [] })
    expect(exposureQueueFallback('unavailable', 10)).toMatchObject({
        generatedAt: '',
        status: 'unavailable',
        items: [],
    })
    expect(normalizeExposureQueue({ items: [] })).toMatchObject({ generatedAt: '', status: 'unavailable' })
    expect(normalizeExposureQueue({ generatedAt: '2026-08-09T00:00:00.000Z', status: 'stale', items: [] })).toMatchObject({
        generatedAt: '2026-08-09T00:00:00.000Z',
        status: 'stale',
    })
})

test('a failed initial check moves an empty homepage feed to unavailable', () => {
    const initial = exposureQueueFallback('checking', 10)
    expect(queueAfterFailedInitialCheck(initial, [])).toMatchObject({
        generatedAt: '',
        status: 'unavailable',
        items: [],
    })
})

test('a failed refresh preserves persisted rows and their stale state', () => {
    const row = { id: 'saved', actor: 'Actor', company: 'Company', claimedData: 'Data', claimedDataSize: 'Small', status: 'unverified' }
    const cached = normalizeExposureQueue({ status: 'stale', items: [row] })
    expect(queueAfterFailedInitialCheck(cached, cached.items)).toBe(cached)
    expect(cached).toMatchObject({ status: 'stale', items: [{ id: 'saved', company: 'Company' }] })
})
