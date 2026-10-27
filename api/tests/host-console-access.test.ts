import { expect, test } from 'bun:test'
import { isHostConsoleAvailable } from '../src/utils/hostConsoleAccess.ts'

test('keeps the unrestricted interactive console off Inspur', () => {
    expect(isHostConsoleAvailable('inspur')).toBe(false)
    expect(isHostConsoleAvailable('ovh')).toBe(true)
    expect(isHostConsoleAvailable('unknown')).toBe(false)
})
