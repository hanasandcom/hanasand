// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { commercialAccessPlans } from '../src/utils/commercialAccess'

const { default: SubscriptionPage } = await import('../src/app/dashboard/subscription/page')

test('subscription dashboard renders its purchase and container options', () => {
    const html = renderToStaticMarkup(createElement(SubscriptionPage))

    expect(html).toContain('aria-label="Available plans"')
    expect(html).toContain('aria-label="Container host options"')
    expect(html).toContain('Loading your containers…')
    expect(html).toContain('Payments and subscription changes are handled securely by Stripe.')

    for (const plan of commercialAccessPlans) {
        expect(html).toContain(plan.name)
        expect(html).toContain(`/api/billing/checkout?plan=${plan.id}`)
        expect(html).toContain('>Buy now</a>')
        expect(html).toContain(plan.summary)
        expect(html).toContain(plan.quota)
        expect(html).toContain('What&#x27;s included')
        for (const feature of plan.features) expect(html).toContain(feature)
    }

    for (const unsupported of ['Enterprise review', 'Workspace entitlements', 'Sales scoped', 'order form']) {
        expect(html).not.toContain(unsupported)
    }
})
