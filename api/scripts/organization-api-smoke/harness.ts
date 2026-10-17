import assert from 'node:assert/strict'
import Fastify, { type FastifyInstance } from 'fastify'
import { mock } from 'bun:test'
import { handleInviteQueries } from './queryInvites.ts'
import { handleMemberQueries } from './queryMembers.ts'
import { handleOrganizationQueries, handleOrganizationTimestampQuery } from './queryOrganization.ts'
import { handleRuleQueries } from './queryRules.ts'
import type { SmokeQueryResult } from './queryTypes.ts'
import { handleWatchlistQueries } from './queryWatchlists.ts'
import { createOrganizationSmokeState, type Row } from './state.ts'
import { iso, memberKey, nowRow, organizationSummary } from './rowHelpers.ts'

export type { Row } from './state.ts'

export interface OrganizationSmokeJourney {
    organization: Row
    invite: Row
    pendingOpsInvite?: Row
    bulkInviteWorkflow?: Row
    staleDeactivatedInvite?: Row
    unknownUserInvite?: Row
    expiredInvite?: Row
    ownerWatchlistItem?: Row
    actorWatchlistItem?: Row
    readiness?: Row
    adminAlertCaseVisibility?: Row
    alertTermsExport?: Row
    adminPortalVisibility?: Row
}

type OrganizationApiRequestOptions = Parameters<FastifyInstance['inject']>[0]
type OrganizationApiResponse = Awaited<ReturnType<FastifyInstance['inject']>>

export interface OrganizationApiSmokeContext {
    app: FastifyInstance
    apiRequest: (options: OrganizationApiRequestOptions, expectedStatus: number) => Promise<OrganizationApiResponse>
    handlers: typeof import('../../src/handlers/organizations.ts')
    orgUtils: typeof import('../../src/utils/organizations.ts')
    users: Map<string, Row>
    tokens: Map<string, string>
    organizations: Map<string, Row>
    members: Map<string, Row>
    invites: Map<string, Row>
    watchlists: Map<string, Row>
    rules: Map<string, Row>
    serviceLogs: Row[]
    authHeaders: typeof authHeaders
    parseBody: typeof parseBody
    assertOrganizationTenantIdentity: typeof assertOrganizationTenantIdentity
    nowRow: typeof nowRow
    memberKey: typeof memberKey
    iso: typeof iso
    organizationSummary: (organizationId: string, role: string) => Row
}

export async function createOrganizationApiSmokeContext(): Promise<OrganizationApiSmokeContext> {
    const state = createOrganizationSmokeState()

    async function fakeRun(query: string, params: any[] = []): Promise<SmokeQueryResult> {
        const compact = query.replace(/\s+/g, ' ').trim()
        const handlers = [
            handleRuleQueries,
            handleOrganizationQueries,
            handleInviteQueries,
            handleMemberQueries,
            handleWatchlistQueries,
            handleOrganizationTimestampQuery,
        ]
        for (const handler of handlers) {
            const result = handler(compact, params, state)
            if (result) return result
        }
        throw new Error(`Unhandled organization smoke query: ${compact}`)
    }

    mock.module('#db', () => ({
        default: fakeRun,
        identityQueryOnce: fakeRun,
        isTransientDatabaseError: () => false,
        withDatabaseAdvisoryLock: async (_key: string, work: (query: typeof fakeRun) => Promise<unknown>) => work(async (query, params) => fakeRun(query, params)),
        withTransaction: async <T>(work: (query: typeof fakeRun) => Promise<T>) => work(async (query, params) => fakeRun(query, params)),
    }))
    mock.module('#utils/auth/tokenWrapper.ts', () => ({
        default: async (req: any) => {
            const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
            const id = String(req.headers.id || '')
            if (!state.tokens.has(token) || state.tokens.get(token) !== id) {
                return { valid: false, id, error: 'Unauthorized.' }
            }
            return { valid: true, id }
        },
    }))

    const handlers = await import('../../src/handlers/organizations.ts')
    const orgUtils = await import('../../src/utils/organizations.ts')
    const app = Fastify({ logger: false })
    try {
        registerOrganizationRoutes(app, handlers)
        await app.ready()
        return {
            app,
            apiRequest: async (options, expectedStatus) => {
                const response = await app.inject(options)
                assert.equal(response.statusCode, expectedStatus, response.body)
                return response
            },
            handlers,
            orgUtils,
            ...state,
            authHeaders,
            parseBody,
            assertOrganizationTenantIdentity,
            nowRow,
            memberKey,
            iso,
            organizationSummary: (organizationId, role) => organizationSummary(state, organizationId, role),
        }
    } catch (error) {
        await app.close()
        throw error
    }
}

function registerOrganizationRoutes(app: FastifyInstance, handlers: typeof import('../../src/handlers/organizations.ts')) {
    app.post('/api/organizations', handlers.postOrganization)
    app.post('/api/organizations/invites/:inviteId/accept', handlers.postOrganizationInviteAccept)
    app.get('/api/organizations/:id/invites', handlers.getOrganizationInvites)
    app.post('/api/organizations/:id/invites', handlers.postOrganizationInvites)
    app.post('/api/organizations/:id/invites/:inviteId/actions', handlers.postOrganizationInviteAction)
    app.get('/api/organizations/:id/members', handlers.getOrganizationMembers)
    app.patch('/api/organizations/:id/members/:userId/role', handlers.patchOrganizationMemberRole)
    app.delete('/api/organizations/:id/members/:userId', handlers.deleteOrganizationMember)
    app.post('/api/organizations/:id/ownership-transfer', handlers.postOrganizationOwnershipTransfer)
    app.get('/api/organizations/:id/settings', handlers.getOrganizationSettings)
    app.put('/api/organizations/:id/settings', handlers.putOrganizationSettings)
    app.get('/api/organizations/:id/alert-readiness', handlers.getOrganizationAlertReadiness)
    app.get('/api/organizations/:id/alert-case-visibility', handlers.getOrganizationAlertCaseVisibility)
    app.get('/api/organizations/:id/watchlists/alert-terms', handlers.getOrganizationWatchlistAlertTerms)
    app.get('/api/organizations/:organizationId/watchlists/:itemId', handlers.getOrganizationWatchlist)
    app.get('/api/organizations/:id/watchlists', handlers.getOrganizationWatchlists)
    app.post('/api/organizations/:id/watchlists', handlers.postOrganizationWatchlist)
    app.post('/api/organizations/:id/watchlists/cleanup', handlers.postOrganizationWatchlistCleanup)
    app.put('/api/organizations/:organizationId/watchlists/:itemId', handlers.putOrganizationWatchlist)
    app.post('/api/organizations/:organizationId/watchlists/:itemId/actions', handlers.postOrganizationWatchlistAction)
    app.delete('/api/organizations/:organizationId/watchlists/:itemId', handlers.deleteOrganizationWatchlist)
    app.get('/api/organizations/:id', handlers.getOrganization)
}

function assertOrganizationTenantIdentity(value: Row, organizationId: string) {
    assert.equal(value.organizationId, organizationId)
    assert.equal(value.tenantId, organizationId)
}

function authHeaders(userId: string, token: string) {
    return {
        authorization: `Bearer ${token}`,
        id: userId,
    }
}

function parseBody(body: string) {
    return JSON.parse(body) as Row
}
