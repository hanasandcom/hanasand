import { expect, test } from 'bun:test'
import { applyDashboardRowDeletion } from '../src/hooks/useDashboardRowDeletion'

test('successful dashboard row deletion hides the row and does not set an error', async () => {
    let hidden = false
    const errors: string[] = []
    await applyDashboardRowDeletion(
        async () => ({ deleted: true }),
        () => { hidden = true },
        message => errors.push(message),
    )

    expect(hidden).toBe(true)
    expect(errors).toEqual([])
})

test('failed dashboard row deletion keeps the row and reports its supplied error', async () => {
    let hidden = false
    const errors: string[] = []
    await applyDashboardRowDeletion(
        async () => ({ deleted: false, error: 'Unable to delete share share-123.' }),
        () => { hidden = true },
        message => errors.push(message),
    )

    expect(hidden).toBe(false)
    expect(errors).toEqual(['Unable to delete share share-123.'])
})
