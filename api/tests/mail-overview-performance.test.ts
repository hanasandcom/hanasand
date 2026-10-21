// @ts-expect-error Bun exposes the test API at runtime.
import { expect, test } from 'bun:test'
import { createMailRuleScheduler } from '../src/utils/mail/filters.ts'

const params = {
    userId: 'user-1', username: 'user-1', password: 'secret',
    inboxMailboxId: 'inbox', mailboxAddress: 'user-1@example.test',
}

test('mail overview rule scheduling does not duplicate in-flight mailbox scans', async () => {
    let finish!: () => void
    let runs = 0
    const schedule = createMailRuleScheduler(async () => {
        runs++
        await new Promise<void>(resolve => { finish = resolve })
    })

    schedule(params, () => {})
    schedule(params, () => {})
    expect(runs).toBe(1)

    finish()
    await Promise.resolve()
    await Promise.resolve()
    schedule(params, () => {})
    expect(runs).toBe(1)
})

test('mail rule scheduler reports failures and allows retry after its interval', async () => {
    let time = 1000
    let runs = 0
    const failures: Error[] = []
    const schedule = createMailRuleScheduler(async () => {
        runs++
        throw new Error('mail rules unavailable')
    }, 30_000, () => time)

    schedule(params, error => failures.push(error))
    await Promise.resolve()
    await Promise.resolve()
    expect(failures).toHaveLength(1)

    schedule(params, error => failures.push(error))
    expect(runs).toBe(1)
    time += 30_000
    schedule(params, error => failures.push(error))
    await Promise.resolve()
    await Promise.resolve()
    expect(runs).toBe(2)
    expect(failures).toHaveLength(2)
})
