import { Suspense } from 'react'
import { DashboardDataFallback, DashboardPage } from '@/components/dashboard/ui'
import BackupPage from './backupPage'
import { getBackupDashboard } from '@/utils/db/internal'

export default function DatabaseBackupsPage() {
    return (
        <DashboardPage>
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
