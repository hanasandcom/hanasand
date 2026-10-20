import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

const sources = {
    inventory: new URL('../src/components/profile/vm.tsx', import.meta.url),
    terminal: new URL('../src/components/vms/consoleClient.tsx', import.meta.url),
    sharedDialog: new URL('../src/components/vms/vmSudoPassword.tsx', import.meta.url),
}

test('VM inventory and terminal expose the audited sudo-password reveal flow', async () => {
    const [inventory, terminal, dialog] = await Promise.all(Object.values(sources).map(path => readFile(path, 'utf8')))

    expect(inventory).toContain('<VMSudoPassword vmName={vm.name} compact')
    expect(inventory).toContain('data-vm-actions')
    expect(terminal).toContain('<VMSudoPassword vmName={name} compact />')
    expect(dialog).toContain('/sudo-password')
    expect(dialog).toContain('currentPassword: password')
    expect(dialog).toContain('cache: \'no-store\'')
})
