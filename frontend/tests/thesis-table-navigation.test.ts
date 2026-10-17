import { expect, test } from 'bun:test'
import { navigateArrowCell } from '../src/app/thesis/tableNavigation'

function keyEvent(key: string, modifiers = {}) {
    let prevented = false
    return {
        event: {
            key,
            metaKey: false,
            ctrlKey: false,
            altKey: false,
            preventDefault: () => { prevented = true },
            ...modifiers,
        },
        wasPrevented: () => prevented,
    }
}

test('table arrow navigation ignores modifiers and unsupported keys', () => {
    const navigations: unknown[] = []
    const modified = keyEvent('ArrowRight', { ctrlKey: true })
    navigateArrowCell(modified.event, 1, 2, 3, (cell, extend) => navigations.push({ cell, extend }))
    const unsupported = keyEvent('Enter')
    navigateArrowCell(unsupported.event, 1, 2, 3, (cell, extend) => navigations.push({ cell, extend }))

    expect(navigations).toEqual([])
    expect(modified.wasPrevented()).toBe(false)
    expect(unsupported.wasPrevented()).toBe(false)
})

test('bounded plan navigation clamps at the table edge and preserves arrow extension', () => {
    let navigation: unknown
    const event = keyEvent('ArrowRight')
    navigateArrowCell(event.event, 2, 4, 3, (cell, extend) => { navigation = { cell, extend } }, { rows: 5, columns: 4 })

    expect(event.wasPrevented()).toBe(true)
    expect(navigation).toEqual({ cell: { table: 2, row: 4, col: 3 }, extend: true })
})

test('unbounded timetable navigation preserves an edge target so the sheet can extend', () => {
    let navigation: unknown
    const event = keyEvent('ArrowDown')
    navigateArrowCell(event.event, 0, 2, 1, (cell, extend) => { navigation = { cell, extend } })

    expect(event.wasPrevented()).toBe(true)
    expect(navigation).toEqual({ cell: { table: 0, row: 3, col: 1 }, extend: true })
})
