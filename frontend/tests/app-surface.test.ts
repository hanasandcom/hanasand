import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { hasAppSidebar } from '../src/utils/routes/appRoutes'
import { isAppSurfacePath } from '../src/components/layout/appSurface'

describe('isAppSurfacePath', () => {
    it('preserves the header AI path rule', () => {
        const options = (pathname: string) => ({
            sidebarVisible: false,
            loggedInTi: false,
            aiPath: pathname.endsWith('/ai') || pathname.includes('/ai/'),
        })

        assert.equal(isAppSurfacePath('/ai', options('/ai')), true)
        assert.equal(isAppSurfacePath('/ai/chat', options('/ai/chat')), true)
        assert.equal(isAppSurfacePath('/aix', options('/aix')), false)
    })

    it('preserves the route frame AI prefix rule', () => {
        const options = (pathname: string) => ({
            sidebarVisible: false,
            loggedInTi: false,
            aiPath: pathname.startsWith('/ai'),
        })

        assert.equal(isAppSurfacePath('/ai/chat', options('/ai/chat')), true)
        assert.equal(isAppSurfacePath('/aix', options('/aix')), true)
    })

    it('uses the caller-specific sidebar and signed-in TI state', () => {
        assert.equal(isAppSurfacePath('/ti', { sidebarVisible: false, loggedInTi: true, aiPath: false }), true)
        assert.equal(isAppSurfacePath('/ti', { sidebarVisible: false, loggedInTi: false, aiPath: false }), false)
        assert.equal(isAppSurfacePath('/ti', { sidebarVisible: hasAppSidebar('/ti'), loggedInTi: false, aiPath: false }), true)
    })

    it('classifies shared account, profile, organization, and share paths', () => {
        const options = { sidebarVisible: false, loggedInTi: false, aiPath: false }

        assert.equal(isAppSurfacePath('/switch-account', options), true)
        assert.equal(isAppSurfacePath('/profile/user', options), true)
        assert.equal(isAppSurfacePath('/organizations/acme', options), true)
        assert.equal(isAppSurfacePath('/s/workspace', options), true)
        assert.equal(isAppSurfacePath('/pricing', options), false)
    })
})
