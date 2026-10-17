// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { DateField, NumberField, RouteChooser, SelectField, TextField } from '../src/app/dashboard/system/rates/RateLimitFields'

const unchanged = () => {}
const labelStart = (label: string) => `<label class="grid gap-1.5 text-sm text-ui-muted"><span>${label}</span>`
const inputClass = 'h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'

test('rate-limit fields share a label shell and keep native control contracts', () => {
    const fields = [
        { label: 'Key name', html: renderToStaticMarkup(<TextField label='Key name' value='service-a' onChange={unchanged} />), control: '<input', value: 'service-a' },
        { label: 'Expires at', html: renderToStaticMarkup(<DateField label='Expires at' value='2026-10-17T23:59:59.999Z' onChange={unchanged} />), control: '<input type="date"', value: '2026-10-17' },
        { label: 'Per second', html: renderToStaticMarkup(<NumberField label='Per second' value={20} min={0} onChange={unchanged} />), control: '<input type="number" min="0"', value: '20' },
        { label: 'Tier', html: renderToStaticMarkup(<SelectField label='Tier' value='growth' options={['starter', 'growth']} onChange={unchanged} />), control: '<select', value: '<option value="growth" selected="">growth</option>' },
        { label: 'Route', html: renderToStaticMarkup(<RouteChooser label='Route' routeOptions={['GET /api/']} value='GET /api/users' onChange={unchanged} />), control: '<input list="rate-limit-routes"', value: 'placeholder="GET /api/"' },
    ]

    for (const field of fields) {
        expect(field.html.startsWith(labelStart(field.label))).toBe(true)
        expect(field.html).toContain(field.control)
        expect(field.html).toContain(`class="${inputClass}"`)
        expect(field.html).toContain(field.value)
        expect(field.html.endsWith('</label>')).toBe(true)
    }
})
