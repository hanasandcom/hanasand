import assert from 'node:assert/strict'
import conversationTitle from '../src/utils/ai/conversationTitle'

for (const value of [undefined, null, '', '   ', 'New chat', 'New workspace review', 'Workspace review']) {
    assert.equal(conversationTitle(value), 'Review assistant')
}
assert.equal(conversationTitle('  Incident analysis  '), 'Incident analysis')
console.log('PASS: generated and blank conversation titles share the Review assistant label.')
