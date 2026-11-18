import { expect, mock, test } from 'bun:test'

const updates: Array<{ name: string, config: Record<string, string> }> = []
mock.module('../src/utils/vms/lxd.ts', () => ({
    updateLocalLxdConfig: async (name: string, config: Record<string, string>) => { updates.push({ name, config }) },
}))

const { startVmConsoleActivity } = await import('../src/utils/vms/consoleActivity.ts')

test('an open VM console records a short-lived activity lease for the watchdog', async () => {
    const before = Date.now()
    const stop = startVmConsoleActivity('gubbernee')
    await Promise.resolve()
    stop()

    expect(updates).toHaveLength(1)
    expect(updates[0].name).toBe('gubbernee')
    const activeUntil = Number(updates[0].config['user.hanasand.console_active_until'])
    expect(activeUntil).toBeGreaterThanOrEqual(before + 90_000)
    expect(activeUntil).toBeLessThanOrEqual(Date.now() + 90_000)
})
