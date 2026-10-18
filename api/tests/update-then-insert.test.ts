import { expect, test } from 'bun:test'
import { updateThenInsert } from '../src/utils/db/updateThenInsert.ts'

type Result = { rowCount: number, rows: string[] }

const result = (rowCount: number, ...rows: string[]): Result => ({ rowCount, rows })
const duplicate = () => Object.assign(new Error('duplicate'), { code: '23505' })

test('returns an update without inserting when the row already exists', async () => {
    let inserts = 0
    const updated = result(1, 'updated')
    const actual = await updateThenInsert(async () => updated, async () => {
        inserts += 1
        return result(1, 'inserted')
    })

    expect(actual).toBe(updated)
    expect(inserts).toBe(0)
})

test('inserts missing rows and retries an insert conflict through the update', async () => {
    const inserted = await updateThenInsert(async () => result(0), async () => result(1, 'inserted'))
    let updates = 0
    const retried = await updateThenInsert(async () => {
        updates += 1
        return updates === 1 ? result(0) : result(1, 'updated-after-conflict')
    }, async () => { throw duplicate() })

    expect(inserted.rows).toEqual(['inserted'])
    expect(retried.rows).toEqual(['updated-after-conflict'])
    expect(updates).toBe(2)
})

test('preserves non-unique errors and throws the original conflict when retry finds no row', async () => {
    const failure = Object.assign(new Error('database unavailable'), { code: '08006' })
    await expect(updateThenInsert(async () => result(0), async () => { throw failure })).rejects.toBe(failure)

    const conflict = duplicate()
    await expect(updateThenInsert(async () => result(0), async () => { throw conflict })).rejects.toBe(conflict)
})

test('returns a missed retry when the caller opts into missing-row results', async () => {
    let updates = 0
    const missed = await updateThenInsert(async () => {
        updates += 1
        return result(0)
    }, async () => { throw duplicate() }, 'return')

    expect(updates).toBe(2)
    expect(missed).toEqual(result(0))
})
