import ContainerHostPlans from '@/components/vms/containerHostPlans'
import { DashboardPage } from 'hanasand/dashboard'
import { commercialAccessPlans } from '@/utils/commercialAccess'
import CommercialPlanCard from '@/components/commercialAccess/commercialPlanCard'
import SubscriptionStatus from './subscriptionStatus'

export const dynamic = 'force-dynamic'

export default function SubscriptionPage() {
    return (
        <DashboardPage>
            <SubscriptionStatus />

            <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4' aria-label='Available plans'>
                {commercialAccessPlans.map(plan => <CommercialPlanCard key={plan.id} plan={plan} surface='dashboard' />)}
            </section>
            <ContainerHostPlans />

            <p className='text-center text-xs text-ui-muted'>Payments and subscription changes are handled securely by Stripe.</p>
        </DashboardPage>
    )
}
