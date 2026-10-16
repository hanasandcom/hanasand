import { afterAll, expect, test } from 'bun:test'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'lxd-response-'))
const socket = join(directory, 'lxd.sock')
let mode = 'interrupt'
const server = http.createServer((_req, res) => {
    if (mode === 'healthy') return void res.end('{"status_code":200,"metadata":[]}')
    res.writeHead(200, { 'Content-Length': '1000' })
    res.write('{')
    if (mode === 'interrupt') setTimeout(() => res.destroy(), 10)
    else {
        const timer = setInterval(() => res.write(' '), 10)
        res.on('close', () => clearInterval(timer))
    }
})
await new Promise<void>(resolve => server.listen(socket, resolve))
const { requestLxdJson } = await import('../src/utils/vms/lxdTransport.ts')
afterAll(() => {
    server.closeAllConnections(); server.close()
    rmSync(directory, { recursive: true, force: true })
})

test('interrupted VM inventory rejects and the next refresh can recover', async () => {
    const result = await Promise.race([
        requestLxdJson(socket, '/1.0/instances?recursion=1', { timeout: 100 }).then(() => 'success', () => 'rejected'),
        new Promise(resolve => setTimeout(() => resolve('stuck'), 300)),
    ])
    expect(result).toBe('rejected')
    mode = 'healthy'
    expect((await requestLxdJson(socket, '/1.0/instances?recursion=1')).metadata).toEqual([])
})

test('continuous partial responses cannot hold the snapshot refresh forever', async () => {
    mode = 'dribble'
    const result = await Promise.race([
        requestLxdJson(socket, '/1.0/instances?recursion=1', { timeout: 100 }).then(() => 'success', () => 'rejected'),
        new Promise(resolve => setTimeout(() => resolve('stuck'), 300)),
    ])
    expect(result).toBe('rejected')
})
