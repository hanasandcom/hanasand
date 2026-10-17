export async function runAccountAndContentChecks(runtime) {
    const { request, runId, password, authHeaders, vmHeaders, expectObject, expectArray } = runtime
    const registration = await request('POST /user', '/user', {
        method: 'POST',
        body: { id: runId, name: 'API Audit Smoke', password },
        expectStatus: 201,
        expect: body => expectObject(body) && Boolean(body.token),
    })
    runtime.token = registration.body.token
    await runtime.grantHanasandEditorAccess()

    const login = await request('POST /auth/login/:id', `/auth/login/${runId}`, {
        method: 'POST',
        body: { password },
        expect: body => expectObject(body) && Boolean(body.token) && !Object.hasOwn(body, 'roles'),
    })
    runtime.token = login.body.token

    await request('GET /', '/', {
        expect: body => typeof body === 'string' && body.includes('Hanasand API'),
    })
    await request('GET /auth/token/:id', `/auth/token/${runId}`, {
        headers: authHeaders(),
        expect: body => expectObject(body) && Boolean(body.token),
    })
    await request('GET /auth/sessions', '/auth/sessions', {
        headers: authHeaders(),
        expect: body => expectObject(body) && Array.isArray(body.sessions),
    })
    await request('GET /users', '/users', { headers: authHeaders(), expect: expectArray })
    await request('GET /user/:id', `/user/${runId}`, {
        expect: body => expectObject(body) && body.id === runId,
    })
    await request('GET /user/full/:id', `/user/full/${runId}`, {
        headers: authHeaders(),
        expect: body => expectObject(body) && body.id === runId && !Object.hasOwn(body, 'roles'),
    })
    await request('GET legacy account-role endpoint', '/roles', {
        headers: authHeaders(),
        expectStatus: [404],
    })

    await checkCertificates(runtime)
    await checkContentAndTools({
        request,
        apiBase: runtime.apiBase,
        runId,
        password,
        expectObject,
        expectArray,
        authHeaders,
        vmHeaders,
    })
}

async function checkCertificates({ request, runId, authHeaders, expectObject, expectArray }) {
    const cert = await request('POST /certificates', '/certificates', {
        method: 'POST',
        headers: authHeaders(),
        body: { name: `cert-${runId}`, public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAuditKey codex' },
        expectStatus: 201,
        expect: body => expectObject(body) && body.ok === true,
    })
    await request('GET /certificates/:id', `/certificates/${cert.body.id}`, { expect: expectObject })
    await request('GET /certificates/user/:id', `/certificates/user/${runId}`, {
        headers: authHeaders(),
        expect: expectArray,
    })
    await request('PUT /certificates/:id', `/certificates/${cert.body.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: { name: `cert-updated-${runId}` },
        expect: body => expectObject(body) && body.ok === true,
    })
    await request('DELETE /certificates/:id', `/certificates/${cert.body.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        expect: body => expectObject(body) && body.ok === true,
    })
}

async function checkContentAndTools({ request, apiBase, runId, password, expectObject, expectArray, authHeaders, vmHeaders }) {
    await request('GET /articles', '/articles', { expect: body => Array.isArray(body) || expectObject(body) })
    await request('GET /thoughts', '/thoughts', { expect: expectArray })
    await request('GET /thought/random', '/thought/random', { expect: () => true })
    await request('POST /pwned', '/pwned', {
        method: 'POST',
        body: { password },
        expect: expectObject,
    })
    await request('POST /tools/http/request', '/tools/http/request', {
        method: 'POST',
        headers: authHeaders(),
        body: { method: 'GET', url: `${apiBase}/` },
        expect: body => expectObject(body) && body.status === 200,
    })
    await checkLogsAndStatus({ request, runId, authHeaders, vmHeaders, expectObject })
}

async function checkLogsAndStatus({ request, runId, authHeaders, vmHeaders, expectObject }) {
    await request('POST /logs/ingest', '/logs/ingest', {
        method: 'POST',
        headers: vmHeaders(),
        body: { service: 'audit', level: 'error', message: `audit log ${runId}`, metadata: { runId } },
        expectStatus: 201,
        expect: body => expectObject(body) && body.ok === true,
    })
    await request('GET /logs/services', '/logs/services', {
        headers: authHeaders(),
        expect: body => expectObject(body) && Array.isArray(body.services),
    })
    await request('GET /logs?level=error', '/logs?level=error', {
        headers: authHeaders(),
        expect: body => expectObject(body) && Array.isArray(body.logs),
    })
    await request('GET /status', '/status', {
        expect: body => expectObject(body) && Array.isArray(body.checks),
    })
}
