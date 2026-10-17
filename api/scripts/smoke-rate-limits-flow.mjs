export async function runRateLimitSmoke(context) {
    await context.cleanup()
    await context.seedAdminUser()

    const settings = await context.request('/rate-limit/settings', {
        headers: context.authHeaders(),
    })
    context.expect(settings.response.status === 200, 'Failed to fetch rate-limit settings.', settings.body)
    context.expect(Array.isArray(settings.body?.routes) && settings.body.routes.some((route) => route.route === '/api/status'), 'Rate-limit route catalog is missing /api/status.', settings.body)
    context.expect(Array.isArray(settings.body?.tierPresets) && settings.body.tierPresets.some((preset) => preset.id === 'starter'), 'Rate-limit tier presets are missing from settings.', settings.body)

    const invalidSettings = await context.request('/rate-limit/settings', {
        method: 'PUT',
        headers: context.authHeaders(),
        body: JSON.stringify({
            enabled: true,
            defaults: settings.body.settings.defaults,
            overrides: [
                { id: 'dup_override_one', enabled: true, scope: 'anonymous', method: 'GET', route: '/api/status', windowMs: 60_000, maxRequests: 10 },
                { id: 'dup_override_two', enabled: true, scope: 'anonymous', method: 'GET', route: '/api/status', windowMs: 60_000, maxRequests: 15 },
            ],
        }),
    })
    context.expect(invalidSettings.response.status === 400, 'Duplicate rate-limit overrides should be rejected.', invalidSettings.body)

    const invalidKey = await context.request('/rate-limit/keys', {
        method: 'POST',
        headers: context.authHeaders(),
        body: JSON.stringify({
            ownerId: context.runId,
            name: 'Invalid duplicate scope key',
            tier: 'starter',
            description: 'Duplicate scope smoke test token',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            scopes: [
                { id: 'dup_one', enabled: true, method: 'GET', route: '/api/status', limits: { perSecond: 2, perMinute: 5, perHour: 20, perDay: 100 } },
                { id: 'dup_two', enabled: true, method: 'GET', route: '/api/status', limits: { perSecond: 2, perMinute: 5, perHour: 20, perDay: 100 } },
            ],
        }),
    })
    context.expect(invalidKey.response.status === 400, 'Duplicate API key scopes should be rejected.', invalidKey.body)

    const key = await context.request('/rate-limit/keys', {
        method: 'POST',
        headers: context.authHeaders(),
        body: JSON.stringify({
            ownerId: context.runId,
            name: 'Smoke status key',
            tier: 'starter',
            description: 'Scoped smoke test token',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            enabled: true,
            scopes: [{ enabled: true, method: 'GET', route: '/api/status', limits: { perSecond: 2, perMinute: 5, perHour: 20, perDay: 100 } }],
        }),
    })
    context.expect(key.response.status === 201, 'Failed to create scoped API key.', key.body)
    context.expect(typeof key.body?.secret === 'string' && key.body.secret.startsWith('hsk_'), 'Issued API key secret was missing.', key.body)
    context.createdKeyIds.push(key.body.apiKey.id)
    context.issuedSecret = key.body.secret

    const sameScopeKey = await context.request('/rate-limit/keys', {
        method: 'POST',
        headers: context.authHeaders(),
        body: JSON.stringify({
            ownerId: context.runId,
            name: 'Second smoke status key',
            tier: 'starter',
            description: 'Independent key using the same route scope',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            enabled: true,
            scopes: [{ enabled: true, method: 'GET', route: '/api/status', limits: { perSecond: 1, perMinute: 5, perHour: 20, perDay: 100 } }],
        }),
    })
    context.expect(sameScopeKey.response.status === 201, 'Two API keys should independently scope the same route.', sameScopeKey.body)
    context.createdKeyIds.push(sameScopeKey.body.apiKey.id)
    context.expect(key.body.apiKey.scopes[0].id !== sameScopeKey.body.apiKey.scopes[0].id, 'API key scope IDs must be globally unique.', {
        first: key.body.apiKey.scopes[0].id,
        second: sameScopeKey.body.apiKey.scopes[0].id,
    })

    await verifyKeyTraffic(context, settings, key)
}

async function verifyKeyTraffic(context, settings, key) {
    const statusFirst = await context.request('/status', { headers: context.apiKeyHeaders() })
    context.expect(statusFirst.response.status === 200, 'Scoped key should access /api/status.', statusFirst.body)
    context.expect(statusFirst.response.headers.get('x-api-key-rate-limit-second') === '2', 'Scoped key second-limit header mismatch.', Object.fromEntries(statusFirst.response.headers.entries()))

    const notes = await context.request('/notes', { headers: context.apiKeyHeaders() })
    context.expect(notes.response.status === 403, 'Scoped key should be rejected from /api/notes.', notes.body)

    const burst = await Promise.all([
        context.request('/status', { headers: context.apiKeyHeaders() }),
        context.request('/status', { headers: context.apiKeyHeaders() }),
        context.request('/status', { headers: context.apiKeyHeaders() }),
    ])
    const burstStatuses = burst.map((entry) => entry.response.status)
    context.expect(burstStatuses.filter((status) => status === 429).length >= 1, 'Burst traffic should trigger at least one 429.', burst.map((entry) => ({ status: entry.response.status, body: entry.body })))
    printSummary(context, settings, key, statusFirst, burstStatuses)
}

function printSummary(context, settings, key, statusFirst, burstStatuses) {
    console.log(JSON.stringify({
        insideDocker: context.insideDocker,
        routeCount: settings.body.routes.length,
        issuedKeyId: key.body.apiKey.id,
        burstStatuses,
        rateLimitHeaders: {
            second: statusFirst.response.headers.get('x-api-key-rate-limit-second'),
            minute: statusFirst.response.headers.get('x-api-key-rate-limit-minute'),
            hour: statusFirst.response.headers.get('x-api-key-rate-limit-hour'),
            day: statusFirst.response.headers.get('x-api-key-rate-limit-day'),
        },
    }, null, 2))
}
