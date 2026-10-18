// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { ApiKeyScopeRows } from '../src/app/dashboard/system/rates/ApiKeyScopeRows'

test('API-key scope rows preserve titles and forward edit and remove actions', () => {
    const scopes = [
        { id: 'scope-1', method: 'GET', route: '/api/users', enabled: true, limits: { perSecond: 2, perMinute: 60, perHour: 1000, perDay: 10000 } },
        { id: 'scope-2', method: 'POST', route: '/api/projects', enabled: false, limits: { perSecond: 1, perMinute: 30, perHour: 500, perDay: 5000 } },
    ] as ApiKeyScopeRule[]
    const changed: ApiKeyScopeRule[] = []
    const removed: string[] = []
    const rows = ApiKeyScopeRows({
        scopes,
        routeOptions: ['GET /api/users', 'POST /api/projects'],
        onChange: (scope) => changed.push(scope),
        onRemove: (scopeId) => removed.push(scopeId),
    })

    expect(rows.map((row) => row.props.title)).toEqual(['Route 1', 'Route 2'])
    rows[1].props.onChange({ ...scopes[1], enabled: true })
    rows[0].props.onRemove()
    expect(changed).toEqual([{ ...scopes[1], enabled: true }])
    expect(removed).toEqual(['scope-1'])
})
