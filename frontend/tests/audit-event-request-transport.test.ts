import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { buildApiQuery, helpdeskEvent, type SystemAuditEvent } from '../src/app/dashboard/helpdesk/audit'
import { auditQuery } from '../src/app/dashboard/management/audit/data'
import { fetchSystemEvents } from '../src/app/dashboard/management/audit/request'

test('audit timelines keep their exact filter and cursor query contract', () => {
    const query = auditQuery({
        service: ' TI ', actor: ['alice', 'ignored'], action: 'role changed', target: 'user/1',
        outcome: 'denied', from: '2026-10-01', to: '2026-10-17', q: 'C++ & admin',
        hql: 'AuditEvents | take 5', ignored: 'value',
    }, 'page+/=')

    assert.equal(query.toString(), 'limit=50&format=timeline&service=TI&actor=alice&action=role+changed&target=user%2F1&outcome=denied&from=2026-10-01&to=2026-10-17&q=C%2B%2B+%26+admin&hql=AuditEvents+%7C+take+5&cursor=page%2B%2F%3D')
})

test('Helpdesk keeps its own allowlisted query and omits UI-only filters', () => {
    const query = buildApiQuery({
        q: 'failed login', org: 'org/1', actor: ['user-1', 'ignored'], target: 'tenant 2',
        action: 'organization.deleted', severity: 'warning', source: 'admin', service: 'hanasand-api',
        entity: 'subject/4', request: 'req + 5', outcome: 'denied', from: '2026-10-01',
        to: '2026-10-17', limit: '25', event: '102', support: 'member',
    })

    assert.equal(query, 'format=helpdesk&q=failed+login&org=org%2F1&actor=user-1&target=tenant+2&action=organization.deleted&severity=warning&source=admin&service=hanasand-api&entity=subject%2F4&request=req+%2B+5&outcome=denied&from=2026-10-01&to=2026-10-17&limit=25')
    assert.equal(query.includes('event='), false)
    assert.equal(query.includes('support='), false)
})

test('shared event transport preserves auth, request options, and error responses', async () => {
    const originalFetch = globalThis.fetch
    const controller = new AbortController()
    let requestUrl = ''
    let requestOptions: RequestInit | undefined
    globalThis.fetch = (async (input: string | URL | Request, options?: RequestInit) => {
        requestUrl = String(input)
        requestOptions = options
        return Response.json({ error: 'Forbidden' }, { status: 403 })
    }) as typeof fetch

    try {
        const response = await fetchSystemEvents('https://api.example', new URLSearchParams({ format: 'helpdesk' }), 'decoded+token', 'user-1', {
            cache: 'no-store', signal: controller.signal,
        })
        assert.equal(requestUrl, 'https://api.example/system/events?format=helpdesk')
        assert.deepEqual(new Headers(requestOptions?.headers).get('authorization'), 'Bearer decoded+token')
        assert.equal(new Headers(requestOptions?.headers).get('id'), 'user-1')
        assert.equal(requestOptions?.cache, 'no-store')
        assert.equal(requestOptions?.signal, controller.signal)
        assert.equal(response.status, 403)
        assert.deepEqual(await response.json(), { error: 'Forbidden' })
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('Helpdesk projection removes unapproved event and context fields', () => {
    const event: SystemAuditEvent & { detail: { report: string } } = {
        id: 1, event_type: 'admin.login', severity: 'notice', source: 'admin', service: 'api',
        actor_id: 'operator', actor_name: 'Operator', object_type: 'user', object_id: 'target-1',
        target_name: 'Target', organization_id: 'org-1', organization_name: 'Example',
        subject_id: 'subject-1', request_id: 'request-1', outcome: 'success', reason: 'Approved',
        ip: '192.0.2.1', user_agent: 'private agent detail', created_at: '2026-10-17T12:00:00Z',
        context: { name: 'Allowed name', targetId: 'target-1', password: 'private', arbitrary: 'unused' },
        detail: { report: 'large private report' },
    }
    const projected = helpdeskEvent(event)

    assert.deepEqual(projected.context, { name: 'Allowed name', targetId: 'target-1' })
    assert.equal('user_agent' in projected, false)
    assert.equal('detail' in projected, false)
    assert.equal(JSON.stringify(projected).includes('private'), false)
    assert.equal(JSON.stringify(projected).includes('arbitrary'), false)
})
