import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, request, getSystemEvents, getSupportInspection, getSupportReadiness } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('audit and support inspection filters retain separate validation contracts', async () => {
    const auditUnsupported = await request(getSystemEvents, { query: { unexpected: 'x' } })
    expect(auditUnsupported.statusCode).toBe(400)
    expect(auditUnsupported.body.detail).toMatchObject({ code: 'unsupported_audit_filter' })
    const inspectionUnsupported = await request(getSupportInspection, { query: { org: 'org-1', unexpected: 'x' } })
    expect(inspectionUnsupported.statusCode).toBe(400)
    expect(inspectionUnsupported.body.detail).toMatchObject({ code: 'unsupported_support_filter' })

    const auditInvalidSeverity = await request(getSystemEvents, { query: { severity: 'urgent' } })
    expect(auditInvalidSeverity.statusCode).toBe(400)
    expect(auditInvalidSeverity.body.detail).toMatchObject({ code: 'invalid_audit_filter', filter: 'severity' })

    const inspectionInvalidSeverity = await request(getSupportInspection, { query: { org: 'org-1', severity: 'urgent' } })
    expect(inspectionInvalidSeverity.statusCode).toBe(400)
    expect(inspectionInvalidSeverity.body.detail).toMatchObject({ code: 'invalid_support_filter', filter: 'severity' })

    const auditInvalidDate = await request(getSystemEvents, { query: { from: 'not-a-date' } })
    expect(auditInvalidDate.body).toMatchObject({ error: 'Invalid audit start time.' })
    const inspectionInvalidDate = await request(getSupportInspection, { query: { org: 'org-1', from: 'not-a-date' } })
    expect(inspectionInvalidDate.body).toMatchObject({ error: 'Invalid audit timeline start time.' })

    const auditInvalidLimit = await request(getSystemEvents, { query: { limit: '' } })
    expect(auditInvalidLimit.body).toMatchObject({ error: 'Audit limit must be a positive number.' })
    const inspectionInvalidLimit = await request(getSupportInspection, { query: { org: 'org-1', limit: '' } })
    expect(inspectionInvalidLimit.body).toMatchObject({ error: 'Support inspection limit must be a positive number.' })

    const overbroadInspection = await request(getSupportInspection, { query: { action: 'support.inspect' } })
    expect(overbroadInspection.statusCode).toBe(400)
    expect(overbroadInspection.body.detail.code).toBe('overbroad_support_timeline_filter')
    const invalidInspectionWithAction = await request(getSupportInspection, { query: { action: 'support.inspect', severity: 'urgent' } })
    expect(invalidInspectionWithAction.body.detail.code).toBe('invalid_support_filter')
    expect(state.queries).toHaveLength(0)
})

test('system audit allows an unfiltered query while support inspection requires a target', async () => {
    const audit = await request(getSystemEvents, { query: {} })
    expect(audit.statusCode).toBe(200)
    expect(state.queries).toHaveLength(2)

    state.queries.length = 0
    const inspection = await request(getSupportInspection, { query: {} })
    expect(inspection.statusCode).toBe(400)
    expect(inspection.body.detail.code).toBe('missing_support_target')
    expect(state.queries).toHaveLength(0)
})

test('support inspection returns preparation validation errors before database reads', async () => {
    const response = await request(getSupportInspection, {
        query: {
            org: 'org-1',
            prepareAction: 'impersonation',
            reason: 'Case review',
            scope: 'read_profile',
            duration_minutes: '4',
        },
    })
    expect(response.statusCode).toBe(400)
    expect(response.body.detail.code).toBe('invalid_duration')
    expect(state.queries).toHaveLength(0)
})

test('support readiness preserves its default audit filters and limit cap', async () => {
    const response = await request(getSupportReadiness, { query: { org: 'org-1', limit: '80' } })
    expect(response.statusCode).toBe(200)
    expect(response.body.filteredTimeline.filter).toMatchObject({
        action: 'support', source: 'system', service: 'hanasand-api', limit: 50,
    })
    const auditQuery = state.queries.find(query => query.sql.includes('FROM system_events event'))
    expect(auditQuery?.values).toEqual(['%org-1%', '%support%', '%system%', '%hanasand-api%', 50])
})

test('support readiness applies shared audit filters with inspection aliases and bindings', async () => {
    const response = await request(getSupportReadiness, { query: {
        org: 'org-1', request: 'request-1', entityType: 'organization', supportSession: 'session-1',
        workflow: 'support.organization', action: 'support.inspect', severity: 'warning', outcome: 'success',
        source: 'admin', service: 'hanasand-api', blocker: 'none', reason: 'case review', scope: 'read_profile',
        context: 'case-7', from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T00:00:00.000Z',
    } })
    expect(response.statusCode).toBe(200)
    const auditQuery = state.queries.find(query => query.sql.includes('FROM system_events event'))
    expect(auditQuery?.sql).toContain('event.organization_id ILIKE')
    for (const predicate of [
        'event.request_id ILIKE', 'event.object_type ILIKE', 'event.subject_id ILIKE',
        'event.context->>\'workflow\' ILIKE', 'event.event_type ILIKE', 'event.severity =',
        'event.outcome =', 'event.source ILIKE', 'event.service ILIKE', 'event.context->>\'blockerCode\' ILIKE',
        'event.reason ILIKE', 'event.context->>\'supportScope\' ILIKE', 'event.context::text ILIKE',
        'event.created_at >=', 'event.created_at <=',
    ]) expect(auditQuery?.sql).toContain(predicate)
    expect(auditQuery?.values).toEqual([
        '%org-1%', '%request-1%', '%session-1%', '%support.organization%', '%organization%',
        '%support.inspect%', 'warning', 'success', '%admin%', '%hanasand-api%', '%none%',
        '%case review%', '%read_profile%', '%case-7%', '2026-09-01T00:00:00.000Z',
        '2026-09-30T00:00:00.000Z', 25,
    ])
})

