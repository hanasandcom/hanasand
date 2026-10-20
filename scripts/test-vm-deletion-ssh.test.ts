import { expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const source = ['vm-authorized-keys.sh', 'vm-ssh-dispatch.sh']
    .map((file) => readFileSync(new URL(`./install-ssh-gateway/${file}`, import.meta.url), 'utf8'))
    .join('\n')

test('SSH guards reject deletion-pending or unreadable VM config before start or exec', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-deletion-ssh-'))
    try {
        const logger = join(directory, 'logger')
        writeFileSync(logger, '#!/bin/sh\nexit 0\n')
        chmodSync(logger, 0o700)
        const mock = join(directory, 'lxc')
        writeFileSync(mock, String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$PROBE_CALLS"
case "$1 $2" in
 'config get') if [ "$PROBE_MODE" = failure ]; then exit 1; fi; printf '%s' "$PROBE_MARKER";;
 'info '*) printf 'Status: STOPPED\n';;
 'exec '*) printf 'fixture-key\n';;
esac
`)
        chmodSync(mock, 0o700)

        for (const name of ['hanasand-vm-authorized-keys', 'hanasand-vm-ssh-dispatch-root']) {
            const match = source.match(new RegExp(`cat >/usr/local/sbin/${name} <<'SH'\\n([\\s\\S]*?)\\nSH`))
            expect(match, `missing script ${name}`).toBeTruthy()
            const script = join(directory, name)
            writeFileSync(script, match![1])
            chmodSync(script, 0o700)

            for (const [mode, marker, blocked] of [['normal', '2026-10-12', true], ['failure', '', true], ['normal', '', false]] as const) {
                const calls = join(directory, 'calls')
                writeFileSync(calls, '')
                const result = spawnSync('bash', [script, 'cashflow'], {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        PATH: `${directory}:${process.env.PATH}`,
                        LXC_BIN: mock,
                        PROBE_CALLS: calls,
                        PROBE_MODE: mode,
                        PROBE_MARKER: marker,
                        HANASAND_GATEWAY_USER: 'cashflow',
                    },
                })
                const invoked = readFileSync(calls, 'utf8')
                if (blocked) {
                    expect(result.status).not.toBe(0)
                    expect(invoked).not.toContain('start cashflow')
                    expect(invoked).not.toContain('exec cashflow')
                } else {
                    expect(result.status, result.stderr).toBe(0)
                }
            }
        }
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('SSH repairs the VM hostname mapping before sudo starts the user shell', () => {
    const match = source.match(/cat >\/usr\/local\/sbin\/hanasand-vm-ssh-dispatch-root <<'SH'\n([\s\S]*?)\nSH/)
    expect(match).toBeTruthy()
    const directory = mkdtempSync(join(tmpdir(), 'vm-ssh-hostname-'))
    try {
        const calls = join(directory, 'calls')
        const repair = join(directory, 'repair')
        const logger = join(directory, 'logger')
        writeFileSync(logger, '#!/bin/sh\nexit 0\n')
        chmodSync(logger, 0o700)
        const mock = join(directory, 'lxc')
        writeFileSync(mock, String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$PROBE_CALLS"
case "$*" in *'127.0.1.1'*) printf 'hostname repair script received\n' > "$PROBE_REPAIR";; esac
case "$*" in
 'config get hei user.hanasand.delete_after') exit 0;;
 'info hei') printf 'Status: RUNNING\n';;
 'exec hei -- true'|'exec hei -- id hei'|'exec hei -- sh -c '*|'exec hei -- sudo -Hiu hei') exit 0;;
esac
`)
        chmodSync(mock, 0o700)
        const script = join(directory, 'dispatch')
        writeFileSync(script, match![1])
        chmodSync(script, 0o700)
        const result = spawnSync('bash', [script], {
            encoding: 'utf8',
            env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, LXC_BIN: mock, PROBE_CALLS: calls, PROBE_REPAIR: repair, HANASAND_GATEWAY_USER: 'hei' },
        })
        expect(result.status).toBe(0)
        const invoked = readFileSync(calls, 'utf8').split('\n')
        const repairIndex = invoked.findIndex((call) => call.startsWith('exec hei -- sh -c '))
        const sudoIndex = invoked.findIndex((call) => call.startsWith('exec hei -- sudo -Hiu hei'))
        expect(repairIndex).toBeGreaterThan(-1)
        expect(readFileSync(repair, 'utf8')).toContain('hostname repair script received')
        expect(sudoIndex).toBeGreaterThan(repairIndex)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
