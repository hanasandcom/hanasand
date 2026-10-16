// @ts-expect-error Bun supplies this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { EditorEmptyState } from '../src/components/share/editorEmptyState'

test('empty editor renders its starter steps and all template choices', () => {
    const html = renderToStaticMarkup(
        <EditorEmptyState displayLineNumbers onInsertTemplate={() => {}} />,
    )

    expect(html).toContain('Start a workspace note')
    expect(html).toContain('Draft one file')
    expect(html).toContain('Capture release notes')
    for (const label of ['Minimal page', 'API handler', 'Runbook', 'Blank markdown']) {
        expect(html).toContain(label)
    }
    expect(html.match(/<button/g)).toHaveLength(4)
    expect(html).toContain('pl-24 sm:pl-14')
})

test('empty editor adjusts its starter card when line numbers are hidden', () => {
    const html = renderToStaticMarkup(<EditorEmptyState displayLineNumbers={false} />)

    expect(html).toContain('pl-20 sm:pl-4')
    expect(html).not.toContain('pl-24 sm:pl-14')
})
