// @ts-expect-error Bun provides this module when running focused tests.
import { expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BackupFile, BackupOperation, BackupService } from '@/utils/db/internal'

mock.module('next/navigation', () => ({
    useRouter: () => ({ refresh() {}, push() {} }),
}))
mock.module('next/link', () => ({
    default: ({ href, children, className }: { href: string, children: ReactNode, className?: string }) =>
        createElement('a', { href, className }, children),
}))
mock.module('../src/app/dashboard/db/actions', () => ({
    deleteBackupAction: async () => ({ message: 'Deleted' }),
    triggerBackupAction: async () => ({ message: 'Started' }),
    restoreBackupAction: async () => ({ message: 'Drill complete' }),
    restoreLiveBackupAction: async () => ({ message: 'Restore complete' }),
}))

const { default: BackupPage } = await import('../src/app/dashboard/db/backups/backupPage')
const { default: RestoreClient } = await import('../src/app/dashboard/db/restore/restoreClient')
const { default: LiveRestoreClient } = await import('../src/app/dashboard/db/restore/liveRestoreClient')

function render(backups: BackupService[], files: BackupFile[] = [], loadError = '') {
    return renderToStaticMarkup(createElement(BackupPage, { backups, files, loadError }))
}

function backupService(overrides: Partial<BackupService> = {}): BackupService {
    return {
        id: 'primary',
        name: 'Primary database',
        status: 'healthy',
        operations: [],
        ...overrides,
    }
}

function operation(overrides: Partial<BackupOperation> = {}): BackupOperation {
    return {
        id: 'operation-1',
        kind: 'backup',
        trigger: 'schedule',
        actorId: 'system',
        status: 'succeeded',
        stage: 'verified_archive',
        startedAt: '2026-03-01T12:34:00.000Z',
        finishedAt: '2026-03-01T12:34:02.000Z',
        durationMs: 2100,
        file: 'backup-2026-03-01.sql.gz',
        targetDatabase: null,
        checksumSha256: '123456789abc987654321',
        sizeBytes: 1024,
        archiveEntries: 1,
        sourceIntegrity: null,
        restoredIntegrity: null,
        targetRemoved: null,
        retention: null,
        error: null,
        releaseCommit: 'release-123456789',
        ...overrides,
    }
}

function renderRestoreDrill(active: BackupOperation) {
    return renderToStaticMarkup(createElement(RestoreClient, {
        backups: [],
        service: backupService({ currentOperation: active, operations: [active] }),
    }))
}

function renderLiveRestore(active: BackupOperation) {
    return renderToStaticMarkup(createElement(LiveRestoreClient, {
        backups: [{ service: 'primary', file: active.file || 'backup.sql.gz', verified: true }],
        service: backupService({ database: 'appdb', currentOperation: active, operations: [active] }),
        file: active.file || 'backup.sql.gz',
    }))
}

function progressStages(html: string) {
    const list = html.match(/<ol class="[^"]+">([\s\S]*?)<\/ol>/)?.[1] || ''
    return [...list.matchAll(/<li class="([^"]+)">([^<]*)<\/li>/g)].map(([, className, label]) => ({ className, label }))
}

test('backup dashboard renders service, archive, verification, retention, and operation evidence', () => {
    const service = backupService({
        lastAttempt: '2026-03-01T12:34:00.000Z',
        lastSuccess: '2026-03-01T12:34:00.000Z',
        latestChecksum: '123456789abc987654321',
        latestVerifiedAt: '2026-03-01T12:35:00.000Z',
        releaseCommit: 'release-123456789',
        storageTarget: 's3://encrypted-backups',
        retention: '30 days',
        retentionOutcome: {
            policyDays: 30,
            examined: 4,
            deleted: 1,
            deletedBytes: 512,
            cutoffAt: '2026-01-01T00:00:00.000Z',
            retained: [{ file: 'backup.sql.gz', slots: ['day:2026-03-01', 'week:2026-03-01'] }],
        },
        operations: [operation()],
    })
    const file: BackupFile = {
        service: 'primary',
        file: 'backup-2026-03-01.sql.gz',
        mtime: '2026-03-01T12:34:00.000Z',
        size: '1 KiB',
        checksumSha256: '123456789abc987654321',
        verified: true,
    }
    const html = render([service], [file])

    expect(html).toContain('s3://encrypted-backups')
    expect(html).toContain('Kept 1 daily + 1 weekly checkpoints; deleted 1')
    expect(html).toContain('backup-2026-03-01.sql.gz')
    expect(html).toContain('123456789abc')
    expect(html).toContain('Backup · schedule')
    expect(html).toContain('2s')
})

test('active backup operation disables conflicting controls and exposes its current stage', () => {
    const active = operation({ status: 'running', stage: 'uploading_archive', finishedAt: null, durationMs: null })
    const html = render([backupService({ currentOperation: active, operations: [active] })], [{
        service: 'primary', file: 'backup.sql.gz', verified: false,
    }])

    expect(html).toContain('Uploading archive')
    expect(html).toMatch(/<button type="button" disabled=""[^>]*data-backup-primary-action/)
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>Restore<\/button>/)
})

test('empty backup data shows load and retention fallbacks', () => {
    const html = render([], [], 'The backup service needs attention. Check API logs for the database backup operation.')

    expect(html).toContain('No archive exists. Run the first verified backup.')
    expect(html).toContain('No completed retention pass yet')
    expect(html).toContain('The previous backup failure did not retain its cause.')
})

test('restore drill preserves its progress panel stages, accessibility, and success copy', () => {
    const html = renderRestoreDrill(operation({
        kind: 'restore_drill', status: 'succeeded', stage: 'checking_integrity',
        targetDatabase: 'restore_drill_test', targetRemoved: true,
        restoredIntegrity: { schemas: 4, tables: 12, estimatedRows: 100 },
        sourceIntegrity: { schemas: 4, tables: 12, estimatedRows: 100 },
    }))
    expect(html).toContain('<section class="rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5" aria-live="polite">')
    expect(html).toContain('Current drill evidence')
    expect(html).toContain('<span class="capitalize text-ui-muted">succeeded</span>')
    expect(html).toContain('mt-4 grid gap-2 text-sm sm:grid-cols-5')
    expect(progressStages(html).map(stage => stage.label)).toEqual([
        'Verifying archive', 'Creating isolated database', 'Restoring', 'Checking integrity', 'Removing isolated database',
    ])
    expect(progressStages(html)[3].className).toContain('border-ui-primary bg-ui-primary/10 text-ui-primary')
    expect(html).toContain('4 schemas, 12 tables, source match passed Target removed: yes.')
})

test('live restore preserves its progress panel stages, breakpoints, and success copy', () => {
    const html = renderLiveRestore(operation({
        kind: 'restore_live', status: 'succeeded', stage: 'checking_integrity', targetDatabase: 'appdb',
        restoredIntegrity: { schemas: 4, tables: 12, estimatedRows: 100 },
    }))
    expect(html).toContain('<section class="rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5" aria-live="polite">')
    expect(html).toContain('Restore progress')
    expect(html).toContain('<span class="capitalize text-ui-muted">succeeded</span>')
    expect(html).toContain('sm:grid-cols-3 xl:grid-cols-6')
    expect(progressStages(html).map(stage => stage.label)).toEqual([
        'Verifying archive', 'Creating restore database', 'Restoring', 'Checking integrity', 'Switching live database', 'Removing previous database',
    ])
    expect(progressStages(html)[3].className).toContain('border-ui-primary bg-ui-primary/10 text-ui-primary')
    expect(html).toContain('4 schemas and 12 tables restored into appdb.')
})

test('both restore progress panels retain operation error text', () => {
    const failed = operation({ kind: 'restore_drill', status: 'failed', error: 'Restore worker failed.' })
    for (const html of [renderRestoreDrill(failed), renderLiveRestore({ ...failed, kind: 'restore_live' })]) {
        expect(html).toContain('<p class="mt-4 text-sm text-ui-text">Restore worker failed.</p>')
    }
})
