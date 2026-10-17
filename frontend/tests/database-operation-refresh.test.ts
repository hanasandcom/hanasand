// @ts-expect-error Bun provides the test module for focused checks.
import { afterAll, expect, mock, test } from 'bun:test'

type Effect = () => void | (() => void)
const effects: Effect[] = []
const intervals: Array<{ callback: () => void, delay: number, id: number }> = []
const cleared: number[] = []
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let refresh = mock(() => {})

mock.module('react', () => ({ useEffect: (effect: Effect) => effects.push(effect) }))
mock.module('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const { useDatabaseOperationRefresh } = await import('../src/app/dashboard/db/useDatabaseOperationRefresh')

afterAll(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
})

function resetTimers() {
    effects.length = 0
    intervals.length = 0
    cleared.length = 0
    refresh = mock(() => {})
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            setInterval(callback: () => void, delay: number) {
                const id = intervals.length + 1
                intervals.push({ callback, delay, id })
                return id
            },
            clearInterval(id: number) { cleared.push(id) },
        },
    })
}

function runEffect() {
    const effect = effects[0]
    expect(effect).toBeDefined()
    return effect()
}

test('idle database pages do not start polling', () => {
    resetTimers()
    useDatabaseOperationRefresh(null, false)

    runEffect()

    expect(intervals).toHaveLength(0)
})

test('pending and active operations refresh at their cadence and clean up', () => {
    const scenarios = [
        { operation: null, pending: true, cadence: undefined, expectedCadence: 1500 },
        { operation: 'running', pending: false, cadence: 2000, expectedCadence: 2000 },
    ] as const

    for (const { operation, pending, cadence, expectedCadence } of scenarios) {
        resetTimers()
        if (cadence === undefined) useDatabaseOperationRefresh(operation, pending)
        else useDatabaseOperationRefresh(operation, pending, cadence)

        const cleanup = runEffect()
        expect(intervals.map(({ delay }) => delay)).toEqual([expectedCadence])
        intervals[0].callback()
        expect(refresh).toHaveBeenCalledTimes(1)

        cleanup?.()
        expect(cleared).toEqual([intervals[0].id])
    }
})

test('backup and restore pages pass their operation state and intervals', async () => {
    const paths = [
        '../src/app/dashboard/db/backups/backupPage.tsx',
        '../src/app/dashboard/db/restore/restoreClient.tsx',
        '../src/app/dashboard/db/restore/liveRestoreClient.tsx',
    ]
    const [backups, restore, liveRestore] = await Promise.all(paths.map((path) => Bun.file(new URL(path, import.meta.url)).text()))

    expect(backups).toContain('useDatabaseOperationRefresh(service?.currentOperation, false, 2000)')
    expect(restore).toContain('useDatabaseOperationRefresh(activeDrill, isPending)')
    expect(liveRestore).toContain('useDatabaseOperationRefresh(activeOperation, isPending)')
})
