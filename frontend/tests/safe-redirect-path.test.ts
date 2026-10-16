import { expect, test } from 'bun:test'
import { safeRedirectPath } from '../src/utils/auth/safeRedirectPath'
import { safeRedirectPath as loginModeRedirectPath } from '../src/app/login/loginMode'
import { safeRedirectPath as requestHelperRedirectPath } from '../src/app/api/auth/login/requestHelpers'

test('shared auth redirect validation keeps internal paths and rejects external targets', () => {
    expect(safeRedirectPath('/dashboard?tab=activity')).toBe('/dashboard?tab=activity')
    for (const path of ['https://example.com', '//example.com', 'dashboard', '', null, undefined]) {
        expect(safeRedirectPath(path)).toBe('/dashboard')
    }
    expect(loginModeRedirectPath).toBe(safeRedirectPath)
    expect(requestHelperRedirectPath).toBe(safeRedirectPath)
})
