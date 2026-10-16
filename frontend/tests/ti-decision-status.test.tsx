// @ts-expect-error Bun provides this module when running tests.
import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DecisionStatus from '../src/app/ti/components/decision-status'

describe('TI decision status pill', () => {
    test.each([
        ['ready', '<span class="shrink-0 rounded-md border border-ui-success/35 bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success">ready</span>'],
        ['review', '<span class="shrink-0 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning">review</span>'],
        ['blocked', '<span class="shrink-0 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning">syncing</span>'],
    ] as const)('%s keeps its label and tone', (status, expected) => {
        const html = renderToStaticMarkup(createElement(DecisionStatus, { status }))
        expect(html).toBe(expected)
    })
})
