import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { vmOperatingSystems, vmServices } from '../src/utils/vms/createOptions'

const components = new URL('../src/components/profile/vms.tsx', import.meta.url)
const consoleSession = new URL('../src/components/vms/useVmConsoleSession.ts', import.meta.url)
const progressHook = new URL('../src/components/vms/useVmProvisioningStatus.ts', import.meta.url)

test('the VM create form offers locally bundled operating systems and installable services', async () => {
    const source = await readFile(components, 'utf8')
    expect(vmOperatingSystems.map(os => os.id)).toEqual(['ubuntu-24.04', 'ubuntu-22.04'])
    expect(vmServices.map(service => service.id)).toEqual(['nodejs', 'postgresql', 'redis', 'python'])
    expect(source).toContain('Operating system')
    expect(source).toContain('Install services')
    expect(source).toContain('selectedServices')
})

test('successful creation opens the terminal without waiting for a VM status fetch', async () => {
    const [source, session, progress] = await Promise.all([readFile(components, 'utf8'), readFile(consoleSession, 'utf8'), readFile(progressHook, 'utf8')])
    expect(source).toContain('Follow setup in its terminal')
    expect(source).toContain('provisioning=1')
    expect(session).toContain('get(\'provisioning\') === \'1\'')
    expect(session).toContain('if (!host && !provisioning)')
    expect(progress).toContain('getVM(name)')
    expect(progress).toContain('status_reason')
    expect(progress).toContain('2500')
})
