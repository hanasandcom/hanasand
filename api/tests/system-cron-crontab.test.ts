import { expect, test } from 'bun:test'
import { normalizeSchedule, parseExistingCronEntries, parseManagedBlock, replaceManagedBlock } from '../src/utils/systemCronCrontab.ts'

const definitions = [
    { id: 'daily-report', name: 'Daily report', defaultSchedule: '0 2 * * *', command: '/srv/report', legacyCommands: ['cd /srv && ./report'] },
    { id: 'hourly-check', name: 'Hourly check', defaultSchedule: '15 * * * *', command: '/srv/check' },
]

test('normalizes five-field cron schedules and rejects unsupported syntax', () => {
    expect(normalizeSchedule('  0   2 * * 1-5  ')).toBe('0 2 * * 1-5')
    expect(() => normalizeSchedule('0 2 * *')).toThrow('exactly five fields')
    expect(() => normalizeSchedule('0 2 * * MON')).toThrow('unsupported characters')
})

test('reads enabled and disabled entries from the managed block', () => {
    const crontab = [
        '# BEGIN HANASAND MANAGED CRON',
        '# id=daily-report name=Daily report',
        '0 2 * * * /srv/report',
        '# id=hourly-check name=Hourly check',
        '# 15 * * * * /srv/check',
        '# END HANASAND MANAGED CRON',
    ].join('\n')

    expect([...parseManagedBlock(crontab)]).toEqual([
        ['daily-report', { schedule: '0 2 * * *', enabled: true }],
        ['hourly-check', { schedule: '15 * * * *', enabled: false }],
    ])
})

test('recognizes current and legacy managed commands outside the block', () => {
    const crontab = [
        '5 3 * * * cd /srv && ./report',
        '10 * * * * /srv/check',
        '0 0 * * * /srv/unmanaged',
        '# 0 1 * * * /srv/report',
    ].join('\n')

    expect([...parseExistingCronEntries(crontab, definitions)]).toEqual([
        ['daily-report', { schedule: '5 3 * * *', enabled: true }],
        ['hourly-check', { schedule: '10 * * * *', enabled: true }],
    ])
})

test('replaces managed entries while preserving unrelated crontab lines', () => {
    const crontab = [
        '# user comment',
        '0 1 * * * /srv/report',
        '30 4 * * * /srv/backup',
        '# BEGIN HANASAND MANAGED CRON',
        '# old managed content',
        '# END HANASAND MANAGED CRON',
    ].join('\n')
    const result = replaceManagedBlock(crontab, new Map([
        ['daily-report', { schedule: '20 5 * * *', enabled: true }],
    ]), definitions)

    expect(result).toContain('# user comment\n30 4 * * * /srv/backup\n\n# BEGIN HANASAND MANAGED CRON')
    expect(result).toContain('# id=daily-report name=Daily report\n20 5 * * * /srv/report')
    expect(result).toContain('# id=hourly-check name=Hourly check\n# 15 * * * * /srv/check')
    expect(result).not.toContain('# old managed content')
    expect(result).not.toContain('0 1 * * * /srv/report')
})
