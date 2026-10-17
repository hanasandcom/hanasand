import { expect, test } from 'bun:test'
import { humanReviewLabel, requiresHumanReview } from '../src/app/dashboard/cases/caseResolution'

test('AI and automation resolutions need review until confirmed', () => {
    expect(requiresHumanReview({ type: 'ai' })).toBe(true)
    expect(requiresHumanReview({ type: 'automation' })).toBe(true)
    expect(requiresHumanReview({ type: 'ai', confirmedAt: '2026-10-16T10:00:00Z' })).toBe(false)
})

test('human, unknown and missing resolutions do not need review', () => {
    expect(requiresHumanReview({ type: 'human' })).toBe(false)
    expect(requiresHumanReview({ type: 'unknown' })).toBe(false)
    expect(requiresHumanReview()).toBe(false)
    expect(requiresHumanReview(null)).toBe(false)
})

test('review labels distinguish pending and confirmed AI resolutions only', () => {
    expect(humanReviewLabel({ type: 'ai' })).toBe('Needs human review')
    expect(humanReviewLabel({ type: 'automation' })).toBe('Needs human review')
    expect(humanReviewLabel({ type: 'ai', confirmedAt: '2026-10-16T10:00:00Z' })).toBe('Human confirmed')
    expect(humanReviewLabel({ type: 'human', confirmedAt: '2026-10-16T10:00:00Z' })).toBeUndefined()
    expect(humanReviewLabel({ type: 'unknown' })).toBeUndefined()
    expect(humanReviewLabel()).toBeUndefined()
})
