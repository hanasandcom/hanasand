// @ts-expect-error Bun provides the test module for focused checks.
import { expect, test } from 'bun:test'

const source = (path: string) => Bun.file(new URL(path, import.meta.url)).text()

test('backup and restore pages share polling while preserving their intervals', async () => {
    const [hook, backups, restore, liveRestore] = await Promise.all([
        source('../src/app/dashboard/db/useDatabaseOperationRefresh.ts'),
        source('../src/app/dashboard/db/backups/backupPage.tsx'),
        source('../src/app/dashboard/db/restore/restoreClient.tsx'),
        source('../src/app/dashboard/db/restore/liveRestoreClient.tsx'),
    ])
    expect(hook).toContain('if (!isPending && !activeOperation) return')
    expect(hook).toContain('intervalMs = 1500')
    expect(hook).toContain('window.setInterval(() => router.refresh(), intervalMs)')
    expect(hook).toContain('return () => window.clearInterval(timer)')
    expect(backups).toContain('useDatabaseOperationRefresh(service?.currentOperation, false, 2000)')
    expect(restore).toContain('useDatabaseOperationRefresh(activeDrill, isPending)')
    expect(liveRestore).toContain('useDatabaseOperationRefresh(activeOperation, isPending)')
})
