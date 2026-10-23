// @ts-expect-error Bun supplies this test module at runtime.
import { expect, test } from 'bun:test'
import { emptyErrorEvents } from '../src/utils/logs/errorEvents'

test('error dashboard fallback starts with empty rows and unavailable counts', () => {
    expect(emptyErrorEvents()).toMatchObject({
        generated_at: '',
        summary: null, summary_available: false,
        errors: [],
    })
})
