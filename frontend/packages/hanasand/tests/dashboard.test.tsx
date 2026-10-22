import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { DashboardPage, DashboardPanel, DashboardTable } from '../src/dashboard'

test('DashboardPage renders the shared page layout and custom class', () => {
    const markup = renderToStaticMarkup(<DashboardPage className='custom'>Content</DashboardPage>)
    expect(markup).toContain('grid min-h-full')
    expect(markup).toContain('custom')
})

test('DashboardPanel forwards semantic attributes', () => {
    const markup = renderToStaticMarkup(<DashboardPanel id='panel' aria-label='Overview'>Content</DashboardPanel>)
    expect(markup).toContain('id="panel"')
    expect(markup).toContain('aria-label="Overview"')
    expect(markup).toContain('border-ui-border bg-ui-panel')
})

test('DashboardTable supports an unstyled body', () => {
    const markup = renderToStaticMarkup(<DashboardTable columnHeaders={<th>Name</th>} bodyClassName={null}><tr><td>One</td></tr></DashboardTable>)
    expect(markup).toContain('<thead')
    expect(markup).toContain('<tbody><tr><td>One</td></tr></tbody>')
})
