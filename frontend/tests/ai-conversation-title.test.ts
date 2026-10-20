import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import conversationTitle from '../src/utils/ai/conversationTitle'

test('blank conversation titles use a short, natural label', () => {
    for (const value of [undefined, null, '', '   ', 'New workspace review', 'Workspace review']) {
        assert.equal(conversationTitle(value), 'New chat')
    }
    assert.equal(conversationTitle('New chat'), 'New chat')
    assert.equal(conversationTitle('  Incident analysis  '), 'Incident analysis')
})
