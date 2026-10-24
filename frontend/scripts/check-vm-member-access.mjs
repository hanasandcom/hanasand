import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const scratch = mkdtempSync(`${tmpdir()}/vm-member-access-`)
const frontend = fileURLToPath(new URL('..', import.meta.url))
const requests = []
const api = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    fetch(request) {
        const { pathname } = new URL(request.url)
        requests.push(pathname)
        if (pathname === '/requests') return Response.json(requests)
        if (pathname.startsWith('/api/auth/token/')) return Response.json({ name: 'Member' })
        if (pathname === '/api/vms' || pathname === '/api/vm/metrics') return Response.json([])
        if (pathname === '/api/vms/dashboard-render-proof-empty-user') return Response.json([])
        if (pathname === '/api/vms/dashboard-render-proof-stalled-user') return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('[]')) } }), { headers: { 'content-type': 'application/json' } })
        if (pathname === '/api/vms/dashboard-render-proof-stalled-error-user') return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('[]')) } }), { status: 404, headers: { 'content-type': 'application/json' } })
        if (pathname.startsWith('/api/vms/')) return Response.json([{ name: 'my-machine', owner: 'dashboard-render-proof-user', status: 'stopped', access_users: [], can_assign_organization: true }])
        if (pathname === '/status') {
            writeFileSync(`${scratch}/state.json`, JSON.stringify({ updatedAt: new Date().toISOString(), compute: { memoryTotalBytes: 123 }, sites: { inspur: { compute: { diskFreeBytes: 456 } } } }))
            return Response.json({ mode: 'normal', readOnly: false, services: [], compute: { memory: 123 }, sites: { inspur: { compute: { memory: 123 } } }, replicaEligibility: { memory: 123 } })
        }
        return Response.json({})
    }
})
const env = {
    ...process.env,
    NEXT_PUBLIC_API: `${api.url}api`, FRONTEND_INTERNAL_API: `${api.url}api`, FRONTEND_AUTH_API: `${api.url}api`,
    RECOVERY_STATUS_URL: `${api.url}status`, RECOVERY_STATE_FILE: `${scratch}/state.json`,
    NEXT_DIST_DIR: '.next/vm-access-check',
    PLAYWRIGHT_MANAGED_SERVERS: '0', PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3267',
    VM_FIXTURE_API: api.url.toString().replace(/\/$/, '')
}
const dev = Bun.spawn(['bun', '--bun', 'next', 'dev', '--webpack', '-p', '3267'], { cwd: frontend, env, stdout: Bun.file(`${scratch}/dev.log`), stderr: Bun.file(`${scratch}/dev-error.log`) })
try {
    let ready = false
    for (let attempt = 0; attempt < 120; attempt++) {
        if (dev.exitCode !== null) throw new Error(`VM fixture server exited; see ${scratch}`)
        if (await fetch(env.PLAYWRIGHT_BASE_URL).then(() => true).catch(() => false)) { ready = true; break }
        await Bun.sleep(500)
    }
    if (!ready) throw new Error(`VM fixture server did not start; see ${scratch}`)
    const args = ['./node_modules/.bin/playwright', 'test', 'tests/vm-member-access.spec.ts', '--workers=1', '--reporter=line']
    if (process.env.VM_MEMBER_ACCESS_GREP) args.push('--grep', process.env.VM_MEMBER_ACCESS_GREP)
    const check = Bun.spawn(args, { cwd: frontend, env, stdout: 'inherit', stderr: 'inherit' })
    process.exitCode = await check.exited
} finally {
    dev.kill()
    await dev.exited
    api.stop(true)
}
