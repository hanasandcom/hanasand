// @ts-expect-error Bun supplies this test module at runtime.
import { expect, test } from 'bun:test'
import { emptyErrorEvents } from '../src/utils/logs/errorEvents'

test('error dashboard fallback starts with empty rows and zero counts', () => {
    expect(emptyErrorEvents()).toMatchObject({
        summary: { total: 0, last_hour: 0, last_24h: 0, server_errors: 0, client_errors: 0 },
        errors: [],
    })
})
