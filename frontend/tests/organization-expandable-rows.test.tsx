import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useExpandableRows } from '@/app/organizations/components/useExpandableRows'

function Preview({ rows, limit }: { rows: string[], limit: number }) {
    const { visibleRows, moreButton } = useExpandableRows(rows, limit)
    return createElement('div', null,
        visibleRows.map(row => createElement('span', { key: row, 'data-preview-row': row }, row)),
        moreButton,
    )
}

test('organization row previews show the visible count and omit expansion at the limit', () => {
    const expanded = renderToStaticMarkup(createElement(Preview, { rows: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], limit: 5 }))
    const exactLimit = renderToStaticMarkup(createElement(Preview, { rows: ['a', 'b', 'c', 'd', 'e'], limit: 5 }))

    expect((expanded.match(/data-preview-row=/g) || []).length).toBe(5)
    expect(expanded).toContain('>2 more</button>')
    expect(exactLimit).toContain('data-preview-row="e"')
    expect(exactLimit).not.toContain('more</button>')
})
