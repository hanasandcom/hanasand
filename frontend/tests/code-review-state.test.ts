import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readSheets, writeSheets, sheetChanges } from '../src/app/thesis/workspace'
import { reviewPriority, reviewStatus, type CodeItem } from '../src/utils/codeReviewTypes'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CodeItemLink } from '../src/app/thesis/CodeItemLink'

test('per-sheet preferences round trip and participate in shared history', () => {
    const sheets = [{ id: 'code', name: 'Code', title: '# Code', body: '\n\nNotes\n', settings: { insertTable: false, history: false, codeReview: true } }]
    assert.deepEqual(readSheets('# Thesis', writeSheets(sheets)), sheets)
    assert.equal(sheetChanges(sheets, [{ ...sheets[0], settings: { ...sheets[0].settings, history: true } }]).length, 1)
})
test('approval belongs to the exact source and dependency version', () => {
    const item = { reviewHash: 'current' } as CodeItem
    assert.equal(reviewStatus(item), 'unreviewed')
    item.review = { event_id: 'event', item_id: 'item', approved: true, content_hash: 'source', review_hash: 'current', reviewer: 'owner', reviewed_at: '2026-09-06T12:00:00Z' }
    assert.equal(reviewStatus(item), 'approved')
    item.reviewHash = 'dependency changed'
    assert.equal(reviewStatus(item), 'changed')
    assert.equal(item.review.review_hash, 'current')
    item.reviewHash = 'current'; item.review.approved = false
    assert.equal(reviewStatus(item), 'unreviewed')
})

test('review priority turns yellow changes red at fourteen days', () => {
    const now = Date.parse('2026-09-20T12:00:00Z')
    const item = { reviewHash: 'new', review: { approved: true, review_hash: 'old', reviewed_at: '2026-09-06T12:00:01Z' } } as CodeItem
    assert.equal(reviewPriority(item, now), 1)
    item.review!.reviewed_at = '2026-09-06T12:00:00Z'
    assert.equal(reviewPriority(item, now), 0)
    item.reviewHash = 'old'
    assert.equal(reviewPriority(item, now), 2)
    delete item.review
    assert.equal(reviewPriority(item, now), 0)
})

test('code inventory and dependency links preserve selected and unselected button markup', () => {
    const item = { id: 'source:workspace', kind: 'source', title: 'workspace.ts', reviewHash: 'current' } as CodeItem
    const render = (selected: boolean) => renderToStaticMarkup(createElement(CodeItemLink, { item, selected, onSelect() {} }))
    const selected = render(true)
    const unselected = render(false)
    assert.match(selected, /<button aria-current="true">/)
    assert.match(selected, /workspace\.ts/)
    assert.match(selected, /class="code-status" data-status="unreviewed"/)
    assert.match(unselected, /<button>/)
    assert.doesNotMatch(unselected, /aria-current/)
})
