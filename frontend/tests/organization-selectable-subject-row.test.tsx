import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SelectableSubjectRow } from '../src/app/organizations/components/selectableSubjectRow'

test('selectable organization rows preserve button state, classes, IDs, markers and content', () => {
    const html = renderToStaticMarkup(createElement(SelectableSubjectRow, {
        selected: true,
        className: 'rounded-lg border p-3 selected-row',
        id: 'invite-invite-1',
        onSelect: () => {},
        dataAttributes: { 'data-org-invite-row': 'true' },
        children: 'analyst@example.test',
    }))

    expect(html).toContain('<div id="invite-invite-1" role="button" tabindex="0" aria-pressed="true"')
    expect(html).toContain('class="rounded-lg border p-3 selected-row"')
    expect(html).toContain('data-org-invite-row="true"')
    expect(html).toContain('>analyst@example.test</div>')
})

test('article and table variants keep their tag and pressed button state', () => {
    for (const tag of ['article', 'tr'] as const) {
        const html = renderToStaticMarkup(createElement(SelectableSubjectRow, {
            as: tag, selected: false, className: 'row', onSelect: () => {}, children: 'member',
        }))
        expect(html).toContain(`<${tag} role="button" tabindex="0" aria-pressed="false"`)
        expect(html).toContain(`>member</${tag}>`)
    }
})
