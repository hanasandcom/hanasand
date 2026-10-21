import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { vmMinecraftServerTypes, vmOperatingSystems, vmResourceOptions, vmServices } from '../src/utils/vms/createOptions'

const components = new URL('../src/components/profile/vms.tsx', import.meta.url)
const createForm = new URL('../src/components/profile/vmCreateForm.tsx', import.meta.url)
const consoleSession = new URL('../src/components/vms/useVmConsoleSession.ts', import.meta.url)
const progressHook = new URL('../src/components/vms/useVmProvisioningStatus.ts', import.meta.url)
const filters = new URL('../src/components/profile/vmFilters.tsx', import.meta.url)
const osPicker = new URL('../src/components/profile/vmOperatingSystemPicker.tsx', import.meta.url)

test('the VM create form offers locally bundled operating systems and installable services', async () => {
    const [source, picker] = await Promise.all([readFile(createForm, 'utf8'), readFile(osPicker, 'utf8')])
    expect(vmOperatingSystems.map(os => os.id)).toEqual(['ubuntu-24.04', 'ubuntu-26.04', 'ubuntu-22.04'])
    expect(vmServices.map(service => service.id)).toEqual(['nodejs', 'bun', 'python', 'java', 'go', 'php', 'docker', 'postgresql', 'mysql', 'redis', 'sqlite', 'nginx', 'website', 'minecraft-java'])
    expect(vmResourceOptions.map(option => `${option.cpu}:${option.memory}`)).toEqual(['1:2GiB', '2:4GiB', '4:8GiB'])
    expect(vmMinecraftServerTypes.map(server => server.id)).toEqual(['PAPER', 'VANILLA', 'FABRIC', 'QUILT', 'NEOFORGE', 'PURPUR', 'FOLIA'])
    expect(picker).toContain('Operating system')
    expect(source).toContain('Install services')
    expect(source).toContain('selectedServices')
    expect(source).toContain('resources: { cpu: resources.cpu, memory: resources.memory }')
    expect(source).toContain('minecraft_eula_accepted: minecraftEulaAccepted')
    expect(source).toContain('website: selectedServices.includes(\'website\') ? websitePlan : null')
    expect(source).toContain('aria-label=\'Website preview\'')
    expect(source).toContain('Add section')
    expect(source).toContain('websitePlan.sections.length >= 5')
    expect(source).toContain('This creates a simple static page.')
    expect(source).toContain('Generate setup')
    expect(source).toContain('option.memory !== \'2GiB\'')
    expect(source).toContain('setCreationError(result.message)')
    expect(source).toContain('role=\'alert\' className=\'rounded-lg border border-ui-danger/25')
})

test('successful creation opens the terminal without waiting for a VM status fetch', async () => {
    const [source, create, session, progress] = await Promise.all([readFile(components, 'utf8'), readFile(createForm, 'utf8'), readFile(consoleSession, 'utf8'), readFile(progressHook, 'utf8')])
    expect(create).toContain('Follow setup in its terminal')
    expect(source).toContain('provisioning=1')
    expect(session).toContain('get(\'provisioning\') === \'1\'')
    expect(session).toContain('if (!host && !provisioning)')
    expect(progress).toContain('getVM(name)')
    expect(progress).toContain('status_reason')
    expect(progress).toContain('2500')
})

test('VM filter popover uses the standard inset and slider-knob icon', async () => {
    const source = await readFile(filters, 'utf8')
    expect(source).toContain('left: position.mobile ? 8 : undefined')
    expect(source).toContain('right = mobile ? 8 :')
    expect(source).toContain('width: position.mobile ? \'calc(100vw - 16px)\'')
    expect(source).toContain('aria-label={activeCount ? `Filters, ${activeCount} active` : \'Filters\'}')
    expect(source).toContain('<path d=\'M2.5 4.5h15M2.5 10h15M2.5 15.5h15\' />')
    expect(source.match(/<circle cx=/g)).toHaveLength(3)
    expect(source).not.toContain('>Filters</button>')
})

test('OS picker gives the arrow breathing room and keeps a custom listbox', async () => {
    const source = await readFile(osPicker, 'utf8')
    expect(source).toContain('role=\'listbox\'')
    expect(source).toContain('px-4 text-left text-sm text-ui-text')
    expect(source).toContain('h-7 w-7 shrink-0 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-muted shadow-sm')
    expect(source).toContain('text-[10px] font-semibold uppercase tracking-[0.14em] text-ui-muted')
})
