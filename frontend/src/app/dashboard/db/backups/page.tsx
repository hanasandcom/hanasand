import { Suspense } from 'react'
import { DashboardDataFallback, DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import BackupPage from './backupPage'
import { getBackupDashboard } from '@/utils/db/internal'

export default function DatabaseBackupsPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Operations'
                title='Database Backups'
                description='Backup health, restore lanes, schedule, and storage context for the production database.'
            />
            <Suspense fallback={<DashboardDataFallback label='backup status' />}>
                <BackupData />
            </Suspense>
        </DashboardPage>
    )
}

async function BackupData() {
    const data = await getBackupDashboard()
    const errors = typeof data === 'string' ? data : data.errors.join(' ')

    return <BackupPage backups={typeof data === 'string' ? [] : data.backups} files={typeof data === 'string' ? [] : data.files} loadError={errors} />
}
