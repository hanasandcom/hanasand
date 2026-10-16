// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CompactRowsToggle, previewRowsForSelection } from '../src/app/ti/components/selectedPreviewList'

const rows = ['one', 'two', 'three', 'four', 'five'].map(id => ({ id }))

test('compact preview preserves a selected row and reports the omitted count', () => {
    const preview = previewRowsForSelection({ rows, selected: rows[1], expanded: false, previewCount: 3 })
    expect(preview.visibleRows.map(row => row.id)).toEqual(['one', 'two', 'three'])
    expect(preview.hiddenCount).toBe(2)
    expect(preview.hasMore).toBe(true)
})

test('selected row outside the compact preview replaces its last row', () => {
    const preview = previewRowsForSelection({ rows, selected: rows[4], expanded: false, previewCount: 3 })
    expect(preview.visibleRows.map(row => row.id)).toEqual(['one', 'two', 'five'])
    expect(preview.hiddenCount).toBe(2)
})

test('expanded preview returns every row and remains collapsible', () => {
    const preview = previewRowsForSelection({ rows, selected: rows[4], expanded: true, previewCount: 3 })
    expect(preview.visibleRows).toEqual(rows)
    expect(preview.hiddenCount).toBe(0)
    expect(preview.hasMore).toBe(true)
})

test('toggle preserves caller labels and classes for both expansion states', () => {
    const className = 'ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
    const more = renderToStaticMarkup(createElement(CompactRowsToggle, {
        hiddenCount: 2,
        expanded: false,
        hasMore: true,
        onExpandedChange: () => {},
        moreLabel: count => `Show ${count} more details`,
        lessLabel: 'Show key details only',
        className,
    }))
    const less = renderToStaticMarkup(createElement(CompactRowsToggle, {
        hiddenCount: 0,
        expanded: true,
        hasMore: true,
        onExpandedChange: () => {},
        moreLabel: count => `Show ${count} more details`,
        lessLabel: 'Show key details only',
        className,
    }))

    expect(more).toBe(`<button type="button" class="${className}">Show 2 more details</button>`)
    expect(less).toBe(`<button type="button" class="${className}">Show key details only</button>`)
    expect(renderToStaticMarkup(createElement(CompactRowsToggle, {
        hiddenCount: 0, expanded: false, hasMore: true, onExpandedChange: () => {},
        moreLabel: count => `Show ${count} more details`, lessLabel: 'Show key details only', className,
    }))).toBe('')
})
