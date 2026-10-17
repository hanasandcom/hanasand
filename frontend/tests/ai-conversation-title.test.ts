import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import conversationTitle from '../src/utils/ai/conversationTitle'

test('generated and blank conversation titles use the assistant label', () => {
    for (const value of [undefined, null, '', '   ', 'New chat', 'New workspace review', 'Workspace review']) {
        assert.equal(conversationTitle(value), 'Review assistant')
    }
    assert.equal(conversationTitle('  Incident analysis  '), 'Incident analysis')
})
