// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusPill } from '../src/app/dashboard/ti/dashboardPresentation'
import { runStatusTone } from '../src/app/dashboard/ti/runs/runPresentation'

test('run status pills preserve their status colors and compact layout', () => {
    const renderStatus = (status: string) => renderToStaticMarkup(
        <StatusPill
            compact
            label={status}
            tone={runStatusTone(status)}
            className='inline-flex w-fit self-start whitespace-nowrap capitalize leading-5'
        />,
    )

    expect(renderStatus('completed')).toBe('<span class="rounded-full border px-2 py-0.5 text-xs font-semibold border-ui-success/35 bg-ui-success/10 text-ui-success inline-flex w-fit self-start whitespace-nowrap capitalize leading-5">completed</span>')
    expect(renderStatus('failed')).toBe('<span class="rounded-full border px-2 py-0.5 text-xs font-semibold border-ui-danger/35 bg-ui-raised/10 text-ui-text inline-flex w-fit self-start whitespace-nowrap capitalize leading-5">failed</span>')
    expect(renderStatus('queued')).toBe('<span class="rounded-full border px-2 py-0.5 text-xs font-semibold border-ui-border bg-ui-panel text-ui-primary inline-flex w-fit self-start whitespace-nowrap capitalize leading-5">queued</span>')
})
