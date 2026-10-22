import ContainerHostPlans from '@/components/vms/containerHostPlans'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import { commercialAccessPlans } from '@/utils/commercialAccess'
import CommercialPlanCard from '@/components/commercialAccess/commercialPlanCard'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Pricing',
    description: 'Clear monthly plans for Hanasand threat intelligence, monitoring, scanning, and API access.',
    path: '/pricing',
    keywords: ['hanasand pricing', 'threat monitoring pricing', 'security scanner pricing'],
})

export default function PricingPage() {
    return (
        <main className='min-h-app-viewport bg-ui-canvas px-4 py-14 text-ui-text md:px-8'>
            <div className='mx-auto grid max-w-7xl gap-8'>
                <header className='mx-auto grid max-w-3xl gap-3 text-center'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Pricing</p>
                    <h1 className='text-4xl font-semibold md:text-6xl'>Know more. Respond faster.</h1>
                    <p className='text-lg leading-8 text-ui-muted'>Search threats. Watch your exposure. Scan your attack surface. Investigate what you find.</p>
                </header>
                <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4' aria-label='Available plans'>
                    {commercialAccessPlans.map(plan => <CommercialPlanCard key={plan.id} plan={plan} surface='marketing' />)}
                </section>
                <ContainerHostPlans />
                <p className='text-center text-xs text-ui-muted'>Secure checkout is handled by Stripe.</p>
            </div>
        </main>
    )
}
