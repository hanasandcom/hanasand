import { expect, test } from 'bun:test'
import { reply, request, postRulePreview } from './support/rule-editing-fixture.ts'

test('preview requires organization membership and validates the submitted selector before reading events', async () => {
    const denied = reply()
    await postRulePreview(request('', {}, 'other-org'), denied as any)
    expect(denied.statusCode).toBe(403)
    const invalid = reply()
    await postRulePreview(request('', { conditions: [{ path: 'message', operator: 'regex', value: '[' }] }), invalid as any)
    expect(invalid.statusCode).toBe(400)
})
