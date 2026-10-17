import { expect, test } from 'bun:test'
import { systemExpiredSessionPath } from '../src/app/dashboard/system/systemRoutes'

test('system session expiry paths preserve the login return route', () => {
    expect(systemExpiredSessionPath()).toBe('/logout?path=/login%3Fpath%3D/system%26expired=true')
    expect(systemExpiredSessionPath('/system/ai')).toBe('/logout?path=/login%3Fpath%3D/system/ai%26expired=true')
    expect(systemExpiredSessionPath('/system/console')).toBe('/logout?path=/login%3Fpath%3D/system/console%26expired=true')
})
