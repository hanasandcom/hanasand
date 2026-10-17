import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('commercial plan cards retain both surface styles and checkout data', () => {
    const rendered = execFileSync('bun', ['-e', `
        import { createElement } from 'react'
        import { renderToStaticMarkup } from 'react-dom/server'
        import CommercialPlanCard from './src/components/commercialAccess/commercialPlanCard'
        import { commercialAccessPlans } from './src/utils/commercialAccess'
        console.log(JSON.stringify(['marketing', 'dashboard'].flatMap(surface => commercialAccessPlans.map(plan => ({
            surface, plan, html: renderToStaticMarkup(createElement(CommercialPlanCard, { plan, surface }))
        })))))
    `], { cwd: root, encoding: 'utf8' })
    const cards = JSON.parse(rendered) as Array<{ surface: 'marketing' | 'dashboard', plan: { id: string, name: string, summary: string, priceNok: number, quota: string, features: string[] }, html: string }>
    for (const { surface, plan, html } of cards) {
        const padding = surface === 'marketing' ? 'p-5' : 'p-4'
        const highlighted = plan.id === 'monitoring'
        const heading = surface === 'marketing' ? 'mt-3 text-xl font-semibold' : 'mt-3 text-lg font-semibold text-ui-text'
        const color = surface === 'dashboard' ? ' text-ui-text' : ''
        const border = highlighted ? 'border-ui-primary ring-1 ring-ui-primary/30' : 'border-ui-border'
        const purchase = surface === 'dashboard'
            ? `mt-4 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-semibold transition ${highlighted ? 'bg-ui-primary text-ui-on-primary hover:opacity-90' : 'border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'}`
            : `mt-4 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-semibold ${highlighted ? 'bg-ui-primary text-ui-on-primary' : 'border border-ui-border bg-ui-raised text-ui-text'}`
        const popularPill = 'rounded-full border border-ui-primary/40 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary'
        expect(html).toContain(`class="flex flex-col rounded-md border bg-ui-panel ${padding} ${border}"`)
        expect(html).toContain(`class="${heading}"`)
        expect(html).toContain(`class="mt-4 text-base font-normal normal-case${color}"`)
        expect(html).toContain(`class="${purchase}" href="/api/billing/checkout?plan=${plan.id}"`)
        expect(html).toContain('>Buy now</a>')
        expect(html).toContain(plan.name)
        expect(html).toContain(plan.summary)
        expect(html).toContain(`${plan.priceNok} kr / month`)
        expect(html).toContain(plan.quota)
        for (const feature of plan.features) expect(html).toContain(feature)
        expect(html.includes(`class="${popularPill}">Most popular</span>`)).toBe(highlighted)
        for (const feature of plan.features) {
            expect(html.includes(`<span>${feature}</span>`)).toBe(surface === 'dashboard')
        }
    }
})

test('pricing and subscription use one truthful commercial access contract', async () => {
    const contract = await readFile(path.join(root, 'src/utils/commercialAccess.ts'), 'utf8')
    const pricing = await readFile(path.join(root, 'src/app/pricing/page.tsx'), 'utf8')
    const subscription = await readFile(path.join(root, 'src/app/dashboard/subscription/page.tsx'), 'utf8')
    const planCard = await readFile(path.join(root, 'src/components/commercialAccess/commercialPlanCard.tsx'), 'utf8')
    const loadTesting = await readFile(path.join(root, 'src/app/dashboard/load-testing/page.tsx'), 'utf8')
    const homepage = await readFile(path.join(root, 'src/app/page.tsx'), 'utf8')
    const contact = await readFile(path.join(root, 'src/components/contact/contact.tsx'), 'utf8')

    expect(pricing).toContain('import { commercialAccessPlans } from \'@/utils/commercialAccess\'')
    expect(subscription).toContain('import { commercialAccessPlans } from \'@/utils/commercialAccess\'')
    expect(contract).toContain('priceNok: 299')
    expect(contract).toContain('priceNok: 499')
    expect(contract).toContain('priceNok: 199')
    expect(contract).toContain('priceNok: 99')
    expect(contract).toContain('100 searches per day')
    expect(contract).toContain('25 watch terms')
    expect(pricing).toContain('surface=\'marketing\'')
    expect(subscription).toContain('surface=\'dashboard\'')
    expect(planCard).toContain('Buy now')
    expect(planCard).toContain('/api/billing/checkout?plan=')
    expect(subscription).not.toContain('Sales scoped')
    expect(subscription).not.toContain('Scope monitoring')

    for (const unsupported of ['$49', '$149', '$399', '$499', '5 evaluation watch terms', '250 watched names', '1,500 watched names', 'Priority analyst review', 'Sales scoped', 'order form']) {
        expect(pricing).not.toContain(unsupported)
        expect(subscription).not.toContain(unsupported)
        expect(contract).not.toContain(unsupported)
    }
    for (const unsupported of ['$19/mo', '$79/mo', '$249/mo', 'Starter and team tiers', 'Bundled with monitoring', 'Slack, webhooks, cases', 'email, webhook, Slack/Jira/SIEM']) {
        expect(loadTesting).not.toContain(unsupported)
        expect(homepage).not.toContain(unsupported)
    }
    expect(contact).not.toContain('[\'email\', \'Email\']')
    expect(contact).not.toContain('webhook / email / API')
})

test('contact requests use the durable idempotent API intake', async () => {
    const helper = await readFile(path.join(root, 'src/utils/contact/submitContactRequest.ts'), 'utf8')
    const api = await readFile(path.join(root, '../api/src/handlers/commercialContactRequests.ts'), 'utf8')
    const persistence = await readFile(path.join(root, '../api/src/handlers/commercialContactPersistence.ts'), 'utf8')
    const schema = await readFile(path.join(root, '../api/src/utils/db/supportSchema.ts'), 'utf8')

    expect(helper).toContain('`${config.url.api}/commercial/contact-requests`')
    expect(helper).toContain('\'Idempotency-Key\': crypto.randomUUID()')
    expect(persistence).toContain('ON CONFLICT (idempotency_key) DO NOTHING')
    expect(api).toContain('idempotency_conflict')
    expect(persistence).toContain('sendSystemMail')
    expect(api).toContain('delivery: notificationStatus === \'notified\' ? \'notified\' : \'stored\'')
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS commercial_contact_requests')
})
