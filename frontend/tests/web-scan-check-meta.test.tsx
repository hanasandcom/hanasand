// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import WebScanCheckMeta from '../src/app/dashboard/vulnerabilities/webScanCheckMeta'

const check = { title: 'Strict transport security', severity: 'high', status: 'fail' } as const

test('history finding row keeps its title and muted severity status', () => {
    const html = renderToStaticMarkup(
        <WebScanCheckMeta
            check={check}
            className='flex flex-wrap justify-between gap-2 text-sm'
            titleClassName='font-medium text-ui-text'
            resultClassName='text-ui-muted'
        />,
    )

    expect(html).toBe('<div class="flex flex-wrap justify-between gap-2 text-sm"><span class="font-medium text-ui-text">Strict transport security</span><span class="text-ui-muted">high · fail</span></div>')
})

test('detail checklist row keeps the check label and status tone', () => {
    const html = renderToStaticMarkup(
        <WebScanCheckMeta
            check={check}
            className='flex flex-wrap justify-between gap-3'
            resultClassName='text-ui-text'
        />,
    )

    expect(html).toBe('<div class="flex flex-wrap justify-between gap-3"><span>Strict transport security</span><span class="text-ui-text">high · fail</span></div>')
})
