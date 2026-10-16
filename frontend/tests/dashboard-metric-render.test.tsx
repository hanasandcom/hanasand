// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Activity } from 'lucide-react'
import { Metric } from '../src/app/dashboard/ti/dashboardPresentation'

const render = (props: Parameters<typeof Metric>[0]) => renderToStaticMarkup(createElement(Metric, props))

test('shared dashboard metric retains overview and activity page styles', () => {
    const overview = render({ title: 'Events', value: 'ready now', icon: createElement(Activity) })
    expect(overview).toContain('text-xl font-semibold capitalize text-ui-text')
    expect(overview).toContain('>ready now</p>')

    const activity = render({ title: 'Last event', value: 'No events yet', icon: createElement(Activity), valueSize: 'large', tone: 'watch' })
    expect(activity).toContain('text-2xl font-semibold text-ui-text')
    expect(activity).not.toContain('capitalize')
    expect(activity).toContain('text-ui-warning')
    expect(activity).toContain('>No events yet</p>')
    expect(activity).toContain('>Last event</p>')
    expect(activity).toContain('bg-ui-panel p-4')
})
