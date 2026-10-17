// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChangeSummaryCard, ReviewEvidencePanel } from '../src/components/share/ShareChatReview'

test('share review cards retain labels, values, and their metric styling', () => {
    const change = renderToStaticMarkup(<ChangeSummaryCard change={{
        id: 'change-1',
        action: 'upsert_share',
        path: 'src/app/page.tsx',
        beforeContent: 'old',
        content: 'new',
        created: true,
    }} />)
    const evidence = renderToStaticMarkup(<ReviewEvidencePanel evidence={null} lastRun={null} />)

    for (const value of ['Type', 'New file', 'Size', '1 line', '+1', '-1', 'Impact', 'Visitor view']) {
        expect(change).toContain(value)
    }
    for (const value of ['Screenshot', 'Screenshot not run yet', 'Journey check', 'Not run yet', 'Page issues', 'Not checked', 'Logs']) {
        expect(evidence).toContain(value)
    }
    expect(`${change}${evidence}`).toContain('rounded-lg border border-ui-border bg-ui-panel/[0.035] px-2 py-1.5')
})
