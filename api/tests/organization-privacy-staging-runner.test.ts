import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const runner = resolve(import.meta.dir, '../scripts/test-organization-privacy-count-staging.sh')
const id = 'a'.repeat(64)
const owner = '012345abcdef'

function fixture(work: (directory: string) => void) {
    const directory = mkdtempSync(join(tmpdir(), 'privacy-stage-offline-'))
    try { work(directory) } finally { rmSync(directory, { recursive: true, force: true }) }
}

function subnet(directory: string, networks: unknown[], routes: unknown[]) {
    writeFileSync(join(directory, 'networks.json'), JSON.stringify(networks))
    writeFileSync(join(directory, 'routes.json'), JSON.stringify(routes))
    return Bun.spawnSync(['bash', '-c', 'source "$1"; privacy_stage_subnet 10.254.250.0/28 "$2/networks.json" "$2/routes.json"', 'fixture', runner, directory])
}

test('subnet preflight accepts empty Docker inventory and null IPAM/configuration', () => fixture(directory => {
    expect(subnet(directory, [], []).exitCode).toBe(0)
    expect(subnet(directory, [{ IPAM: null }, { IPAM: { Config: null } }, {}], [{ dst: 'default' }, { dst: '192.168.1.0/24' }]).exitCode).toBe(0)
}))

test('subnet preflight rejects either Docker or host-route overlap', () => fixture(directory => {
    expect(subnet(directory, [{ IPAM: { Config: [{ Subnet: '10.254.250.0/24' }] } }], []).exitCode).not.toBe(0)
    expect(subnet(directory, [], [{ dst: '10.254.250.4/32' }]).exitCode).not.toBe(0)
}))

const fakeDocker = `
docker() {
    printf '%s\\n' "$*" >> "$TRACE"
    if [[ "$1" == info ]]; then [[ "$SCENARIO" != daemon-failure ]]; return; fi
    local kind=$1 operation=$2
    if [[ "$operation" == inspect ]]; then
        [[ "$SCENARIO" != inspect-failure ]] || return 1
        [[ -f "$RESOURCE" ]] || return 1
        if [[ "\${3:-}" == --format ]]; then
            if [[ "$SCENARIO" == foreign-owner ]]; then echo another-owner; else echo "$OWNER"; fi
        fi
        return 0
    fi
    if [[ "$operation" == ls ]]; then
        [[ "$SCENARIO" != list-failure ]] || return 1
        if [[ -f "$RESOURCE" ]]; then echo "$ID"; fi
        return 0
    fi
    if [[ "$operation" == rm ]]; then
        [[ "$SCENARIO" != remove-failure ]] || return 1
        rm -f "$RESOURCE"
        return 0
    fi
    return 2
}
`

function cleanup(directory: string, scenario: string, full = false, kind = 'container') {
    const resource = join(directory, 'resource')
    const trace = join(directory, 'trace')
    writeFileSync(resource, '')
    const body = full
        ? 'runner_id=$ID; database_id=""; network_id=""; run_id=$OWNER; temporary=$TEMPORARY; privacy_stage_cleanup 0'
        : 'privacy_stage_remove "$KIND" "$ID" "$OWNER"'
    const result = Bun.spawnSync(['bash', '-c', `source "$1"; ${fakeDocker}\n${body}`, 'fixture', runner], {
        env: { ...process.env, SCENARIO: scenario, RESOURCE: resource, TRACE: trace, ID: id, OWNER: owner, KIND: kind, TEMPORARY: join(directory, 'unused') },
    })
    return { result, trace: readFileSync(trace, 'utf8') }
}

test('cleanup refuses ownership mismatch without deleting foreign containers or networks', () => fixture(directory => {
    for (const kind of ['container', 'network']) {
        const { result, trace } = cleanup(directory, 'foreign-owner', false, kind)
        expect(result.exitCode).not.toBe(0)
        expect(trace).not.toContain(' rm ')
        expect(result.stderr.toString()).toContain('ownership label differs')
    }
}))

test('cleanup deletes only the recorded immutable ID and verifies absence', () => fixture(directory => {
    const { result, trace } = cleanup(directory, 'owned')
    expect(result.exitCode).toBe(0)
    expect(trace).toContain(`container rm -f ${id}`)
    expect(trace).toContain(`container ls -a --quiet --no-trunc --filter id=${id}`)
    expect(trace).not.toContain('hanasand-privacy-count-')
}))

test('cleanup failure and unavailable daemon propagate without claiming absence', () => fixture(directory => {
    for (const scenario of ['remove-failure', 'foreign-owner', 'daemon-failure', 'inspect-failure', 'list-failure']) {
        const { result } = cleanup(directory, scenario, true)
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout.toString()).not.toContain('confirmed absent')
    }
}))

test('completed owned cleanup reports confirmed absence', () => fixture(directory => {
    const { result } = cleanup(directory, 'owned', true)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toContain('confirmed absent')
}))
