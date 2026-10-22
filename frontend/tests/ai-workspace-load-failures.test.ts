// @ts-expect-error Bun provides this module when running tests.
import { mock, test, expect } from 'bun:test'

let authStatus: 'ready' | 'unauthenticated' | 'unauthorized' | 'unavailable' = 'ready'
let redirectTo: string | null = null
const props: Record<string, unknown>[] = []

mock.module('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => ({ value: 'present' }) }) }))
mock.module('next/navigation', () => ({
    redirect: (path: string) => {
        redirectTo = path
        throw new Error('NEXT_REDIRECT')
    },
}))
mock.module('@/utils/share/getUserShares', () => ({ getUserShares: async () => [] }))
mock.module('@/utils/organizations/hanasandMembership', () => ({ isHanasandOrganizationMember: async () => false }))
mock.module('@/utils/ai/getWorkspace', () => ({
    getAiWorkspace: async () => ({
        authStatus,
        conversations: [],
        repositories: [],
        deployments: [],
        releases: [],
        deployQuota: null,
        ownershipSummary: null,
        runtimeState: null,
    }),
}))
mock.module('../src/app/ai/pageClient', () => ({ default: (value: Record<string, unknown>) => { props.push(value); return null } }))

const { default: AIWorkspacePage } = await import('../src/app/ai/AIWorkspacePage')

test('invalid sessions return to sign-in so saved chat history can load again', async () => {
    authStatus = 'unauthorized'
    await expect(AIWorkspacePage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectTo).toBe('/login?path=%2Fai&expired=true')
    expect(props).toHaveLength(0)
})

test('temporary workspace failures reach the client as a load error', async () => {
    authStatus = 'unavailable'
    const page = await AIWorkspacePage() as { props: Record<string, unknown> }
    expect(page.props.initialWorkspaceUnavailable).toBe(true)
})
