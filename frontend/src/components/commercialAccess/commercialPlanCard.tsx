import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { commercialAccessPlans } from '@/utils/commercialAccess'

type Plan = typeof commercialAccessPlans[number]
type Surface = 'marketing' | 'dashboard'

export default function CommercialPlanCard({ plan, surface }: { plan: Plan, surface: Surface }) {
    const highlighted = plan.id === 'monitoring'
    const dashboard = surface === 'dashboard'
    const articlePadding = dashboard ? 'p-4' : 'p-5'
    const headingClass = dashboard ? 'mt-3 text-lg font-semibold text-ui-text' : 'mt-3 text-xl font-semibold'
    const purchaseClass = dashboard
        ? `mt-4 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-semibold transition ${highlighted ? 'bg-ui-primary text-ui-on-primary hover:opacity-90' : 'border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'}`
        : `mt-4 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-semibold ${highlighted ? 'bg-ui-primary text-ui-on-primary' : 'border border-ui-border bg-ui-raised text-ui-text'}`

    return <article className={`flex flex-col rounded-md border bg-ui-panel ${articlePadding} ${highlighted ? 'border-ui-primary ring-1 ring-ui-primary/30' : 'border-ui-border'}`}>
        <div className='flex-1'>
            {highlighted ? <span className='rounded-full border border-ui-primary/40 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary'>Most popular</span> : null}
            <h2 className={headingClass}>{plan.name}</h2>
            <p className='mt-2 min-h-12 text-sm leading-5 text-ui-muted'>{plan.summary}</p>
            <p className={`mt-4 text-base font-normal normal-case${dashboard ? ' text-ui-text' : ''}`}>{plan.priceNok} kr / month</p>
            <p className='mt-1 text-sm font-semibold text-ui-primary'>{plan.quota}</p>
            <Link href={`/api/billing/checkout?plan=${plan.id}`} className={purchaseClass}>Buy now</Link>
            <div className='mt-4 border-t border-ui-border pt-3'>
                <p className={`text-sm font-semibold${dashboard ? ' text-ui-text' : ''}`}>What's included</p>
                <ul className='mt-3 grid gap-2 text-sm text-ui-muted'>
                    {plan.features.map(feature => <li key={feature} className='flex items-start gap-2'><CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-ui-success' />{dashboard ? <span>{feature}</span> : feature}</li>)}
                </ul>
            </div>
        </div>
    </article>
}
