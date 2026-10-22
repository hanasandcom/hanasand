import { DashboardPage } from 'hanasand/dashboard'
import Projects from '@/components/projects/projects'
import Shares from '@/components/share/dashboard/projects'

export const dynamic = 'force-dynamic'

export default function Page() {
    return <DashboardPage>
        <div className='grid gap-4'>
            <header>
                <h1 className='text-2xl font-semibold text-ui-text'>Repositories</h1>
                <p className='mt-1 text-sm text-ui-muted'>Manage repositories and the files within them.</p>
            </header>
            <section aria-labelledby='repository-list-heading' className='grid gap-2'>
                <h2 id='repository-list-heading' className='text-lg font-semibold text-ui-text'>Repositories</h2>
                <Projects emptyTitle='' />
            </section>
            <section aria-labelledby='repository-files-heading' className='grid gap-2'>
                <h2 id='repository-files-heading' className='text-lg font-semibold text-ui-text'>Files</h2>
                <Shares title='Files' showHeading={false} />
            </section>
        </div>
    </DashboardPage>
}
