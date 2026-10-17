// @ts-expect-error Bun provides this module when running tests.
import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SelectedPanelHeader from '../src/app/ti/components/selected-panel-header'

describe('TI selected panel header', () => {
    test('preserves the responsive title and action layout', () => {
        const html = renderToStaticMarkup(createElement(SelectedPanelHeader, {
            title: 'Case request · 2 alerts',
        }, createElement('button', { type: 'button' }, 'Copy')))

        expect(html).toBe(
            '<div class="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs"><p class="min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted">Case request · 2 alerts</p><div class="flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0"><button type="button">Copy</button></div></div>',
        )
    })
})
