// @ts-expect-error Bun provides this module when running tests.
import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SelectedWatchTerms from '../src/app/ti/components/selected-watch-terms'

describe('selected TI watch terms', () => {
    test('preserves compact tags, preview limit, and empty copy', () => {
        const terms = ['alpha', 'bravo', 'charlie', 'delta', 'echo']
        const html = renderToStaticMarkup(createElement(SelectedWatchTerms, { terms, previewCount: 4 }))
        expect(html.match(/<span/g)).toHaveLength(4)
        expect(html).toContain('alpha')
        expect(html).toContain('delta')
        expect(html).not.toContain('echo')
        expect(html).toContain('rounded-md border border-ui-border')

        const draft = renderToStaticMarkup(createElement(SelectedWatchTerms, { terms, previewCount: 3 }))
        expect(draft.match(/<span/g)).toHaveLength(3)
        expect(draft).not.toContain('delta')

        const empty = renderToStaticMarkup(createElement(SelectedWatchTerms, { terms: [], previewCount: 3 }))
        expect(empty).toContain('Add watch term.')
    })
})
