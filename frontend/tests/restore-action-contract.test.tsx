import { expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BackupFile, BackupService } from '@/utils/db/internal'

mock.module('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }) }))
mock.module('next/link', () => ({
    default: ({ href, children }: { href: string, children: React.ReactNode }) => createElement('a', { href }, children),
}))
mock.module('../src/app/dashboard/db/actions', () => ({ restoreBackupAction: async () => ({ message: 'Drill complete' }), restoreLiveBackupAction: async () => ({ message: 'Restore complete' }) }))

const { default: RestoreClient } = await import('../src/app/dashboard/db/restore/restoreClient')
const { default: LiveRestoreClient } = await import('../src/app/dashboard/db/restore/liveRestoreClient')

const backup: BackupFile = { service: 'primary', file: 'backup.sql.gz', verified: true }
const service: BackupService = { id: 'primary', name: 'Primary database', status: 'healthy', operations: [], database: 'appdb' }

test('restore pages retain distinct confirmation and destructive-action contracts', () => {
    const drill = renderToStaticMarkup(createElement(RestoreClient, { backups: [backup], service }))
    const live = renderToStaticMarkup(createElement(LiveRestoreClient, { backups: [backup], service, file: backup.file }))

    expect(drill).toContain('Type <code class="font-mono text-ui-primary">RESTORE restore_drill_')
    expect(drill).toContain('data-restore-primary-action')
    expect(drill).toContain('Run isolated restore drill')
    expect(drill).toContain('This workflow never restores over the live database.')
    expect(live).toContain('Type <code class="font-mono text-ui-primary">RESTORE appdb</code> to confirm')
    expect(live).toContain('data-live-restore-action')
    expect(live).toContain('class="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-ui-danger')
    expect(live).toContain('Restore database')
    expect(live).toContain('This replaces all data in appdb with the selected backup.')
})
