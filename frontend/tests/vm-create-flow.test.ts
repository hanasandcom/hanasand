import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { vmMinecraftServerTypes, vmOperatingSystems, vmResourceOptions, vmServiceTabs, vmServices } from '../src/utils/vms/createOptions'
import { getVmProvisioningFeedback, getVmProvisioningUnavailableFeedback } from '../src/components/vms/useVmProvisioningStatus'
import getVM from '../src/utils/vms/fetch/getVM'

const components = new URL('../src/components/profile/vms.tsx', import.meta.url)
const createForm = new URL('../src/components/profile/vmCreateForm.tsx', import.meta.url)
const createSubmission = new URL('../src/components/profile/vmCreateSubmission.ts', import.meta.url)
const consoleSession = new URL('../src/components/vms/useVmConsoleSession.ts', import.meta.url)
const progressHook = new URL('../src/components/vms/useVmProvisioningStatus.ts', import.meta.url)
const filters = new URL('../src/components/profile/vmFilters.tsx', import.meta.url)
const osPicker = new URL('../src/components/profile/vmOperatingSystemPicker.tsx', import.meta.url)
const resourcePicker = new URL('../src/components/profile/vmResourcePicker.tsx', import.meta.url)
const createRequest = new URL('../src/utils/vms/fetch/postVM.ts', import.meta.url)

test('the VM create form offers locally bundled operating systems and installable services', async () => {
    const [source, submission, picker, resourcePickerSource, websiteEditor, minecraftAddonPicker] = await Promise.all([readFile(createForm, 'utf8'), readFile(createSubmission, 'utf8'), readFile(osPicker, 'utf8'), readFile(resourcePicker, 'utf8'), readFile(new URL('../src/components/profile/vmWebsiteEditor.tsx', import.meta.url), 'utf8'), readFile(new URL('../src/components/profile/vmMinecraftAddonPicker.tsx', import.meta.url), 'utf8')])
    expect(vmOperatingSystems.map(os => os.id)).toEqual(['ubuntu-24.04', 'ubuntu-24.04-desktop', 'ubuntu-26.04', 'ubuntu-22.04', 'debian-13', 'kali', 'fedora-44', 'almalinux-9', 'rocky-9', 'centos-stream-10'])
    expect(vmServices.map(service => service.id)).toEqual(['nodejs', 'bun', 'python', 'java', 'go', 'php', 'rust', 'ruby', 'cpp', 'docker', 'postgresql', 'mysql', 'redis', 'sqlite', 'nginx', 'website', 'minecraft-java'])
    expect(vmServiceTabs).toEqual([
        { id: 'development', label: 'Development', groups: ['Development'] },
        { id: 'data', label: 'Data', groups: ['Data'] },
        { id: 'web-games', label: 'Web & games', groups: ['Web', 'Game servers'] },
    ])
    expect(vmServices.find(service => service.id === 'java')?.description).toContain('selected operating system')
    expect(vmResourceOptions.map(option => `${option.cpu}:${option.memory}:${option.disk}`)).toEqual(['1:2GiB:10GiB', '2:4GiB:20GiB', '4:8GiB:40GiB', '2:4GiB:40GiB'])
    expect(vmMinecraftServerTypes.map(server => server.id)).toEqual(['PAPER', 'VANILLA', 'FABRIC', 'QUILT', 'NEOFORGE', 'FORGE', 'PURPUR', 'FOLIA'])
    expect(picker).toContain('Operating system')
    expect(resourcePickerSource).toContain('label=\'Resources\'')
    expect(resourcePickerSource).toContain('option.id === \'custom\'')
    expect(source).toContain('<VmResourcePicker value={resourcePlan} onChange={setResourcePlan} disabled={creating} availableOptions={availableResources} />')
    expect(source).toContain('Install services')
    expect(source).toContain('role=\'tablist\' aria-label=\'Service categories\'')
    expect(source).toContain('aria-selected={activeServiceTab === tab.id}')
    expect(source).toContain('aria-labelledby={`${promptId}-service-tab-${activeServiceTab}`}')
    expect(source).toContain('setActiveServiceTab(tab.id)')
    expect(source).toContain('selectedServices')
    expect(source).toContain('resources: currentResources')
    expect(submission).toContain('minecraft_eula_accepted: input.selectedServices.includes(\'minecraft-java\')')
    expect(source).not.toContain('I accept the')
    expect(submission).toContain('minecraft_addons: input.minecraftAddons')
    expect(minecraftAddonPicker).toContain('Popular plugins')
    expect(minecraftAddonPicker).toContain('Popular mods')
    expect(minecraftAddonPicker).toContain('Matched to the newest Minecraft release supported by the selected software.')
    expect(submission).toContain('website: input.selectedServices.includes(\'website\') ? input.websitePlan : null')
    expect(websiteEditor).toContain('aria-label=\'Website preview\'')
    expect(websiteEditor).toContain('Contact email')
    expect(websiteEditor).toContain('Gallery images')
    expect(websiteEditor).toContain('pattern=\'https://.*\'')
    expect(websiteEditor).toContain('Add image')
    expect(websiteEditor).toContain('Add section')
    expect(websiteEditor).toContain('plan.sections.length >= 5')
    expect(websiteEditor).toContain('This publishes a responsive static page.')
    expect(source).toContain('Generate setup')
    expect(source).toContain('unresolvedSetupPrompt')
    expect(source).toContain('suggestedSetupKey !== currentSetupKey')
    expect(source).toContain('Generate a supported setup for this description, or clear it to create a blank VM.')
    expect(submission).toContain('custom_apt_packages: input.customAptPackages')
    expect(source).toContain('Additional Ubuntu packages: {customAptPackages.join(\', \')}')
    expect(source).toContain('option.memory !== \'2GiB\'')
    expect(source).toContain('const requiresLargePlan = operatingSystem === \'ubuntu-24.04-desktop\'')
    expect(source).toContain('if (value === \'ubuntu-24.04-desktop\' && resourcePlan !== \'custom\') setResourcePlan(\'large\')')
    expect(submission).toContain('input.setCreationError(result.message)')
    expect(source).toContain('role=\'alert\' className=\'rounded-lg border border-ui-danger/25')
    expect(source).toContain('setProjectFiles(plan.projectFiles || [])')
    expect(submission).toContain('project_files: input.projectFiles.length ? input.projectFiles : undefined')
    expect(source).toContain('projectFiles.length > 0 || (selectedServices.includes(\'minecraft-java\') && [\'FABRIC\', \'QUILT\', \'FORGE\', \'NEOFORGE\', \'FOLIA\'].includes(minecraftServerType))')
    expect(source).toContain('if (plan.projectFiles?.length && resourcePlan === \'small\') setResourcePlan(\'standard\')')
    expect(source).toContain('a custom app')
    expect(source).toContain('disabled={projectFiles.length > 0 && [\'nodejs\', \'website\', \'minecraft-java\'].includes(service.id)}')
})

test('successful creation opens the terminal without waiting for a VM status fetch', async () => {
    const [source, submission, session, progress] = await Promise.all([readFile(components, 'utf8'), readFile(createSubmission, 'utf8'), readFile(consoleSession, 'utf8'), readFile(progressHook, 'utf8')])
    expect(submission).toContain('Follow setup in its terminal')
    expect(source).toContain('provisioning=1')
    expect(session).not.toContain('get(\'provisioning\') === \'1\'')
    expect(progress).toContain('new URLSearchParams(window.location.search).get(\'provisioning\') !== \'1\'')
    expect(progress).toContain('getVM(name, undefined, undefined, organizationId || null)')
    expect(progress).toContain('}, [name, enabled, organizationId])')
    expect(await readFile(consoleSession, 'utf8')).toContain('useVmProvisioningStatus(name, enabled, organizationId)')
    expect(progress).toContain('status_reason')
    expect(progress).toContain('2500')
})

test('the console reports real VM setup progress, completion, and failure separately from its connection state', async () => {
    const consoleClient = await readFile(new URL('../src/components/vms/consoleClient.tsx', import.meta.url), 'utf8')
    expect(getVmProvisioningFeedback().state).toBe('provisioning')
    expect(getVmProvisioningFeedback('PROVISIONING', 'Installing nodejs, postgresql…')).toEqual({
        state: 'provisioning',
        message: 'Installing nodejs, postgresql…',
    })
    expect(getVmProvisioningFeedback('RUNNING').state).toBe('ready')
    expect(getVmProvisioningFeedback('ERROR', 'Package installation failed.')).toEqual({
        state: 'error',
        message: 'Package installation failed.',
    })
    expect(getVmProvisioningUnavailableFeedback()).toEqual({
        state: 'provisioning',
        message: 'Unable to refresh setup status. The VM may still be provisioning; this console will keep checking.',
    })
    expect(await readFile(progressHook, 'utf8')).toContain('consecutiveUnavailableReads >= 1')
    expect(consoleClient).toContain('session.provisioning &&')
    expect(consoleClient).toContain('role={session.provisioning.state === \'error\' ? \'alert\' : \'status\'}')
})

test('provisioning status scopes its VM fetch to the active organization', async () => {
    const originalFetch = globalThis.fetch
    let requestedHeaders: Headers | undefined
    globalThis.fetch = async (_input, init) => {
        requestedHeaders = new Headers(init?.headers)
        return new Response(JSON.stringify([{ name: 'hei', status: 'PROVISIONING' }]), { status: 200 })
    }

    try {
        const result = await getVM('hei', 'test-token', 'test-user', 'vm-stage-cashflow')
        expect(result?.[0]?.status).toBe('PROVISIONING')
        expect(requestedHeaders?.get('x-organization-id')).toBe('vm-stage-cashflow')
        expect(requestedHeaders?.get('id')).toBe('test-user')
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('organization VM creation enforces access without the owner/admin disclaimer', async () => {
    const [inventory, form, submission] = await Promise.all([readFile(components, 'utf8'), readFile(createForm, 'utf8'), readFile(createSubmission, 'utf8')])
    expect(inventory).toContain('[\'owner\', \'admin\'].includes(activeOrganization?.role || \'\')')
    expect(inventory).toContain('}, [organizationId, router])')
    expect(inventory).toContain('}, [update])')
    expect(inventory).toContain('const hasOrganizationContext = Boolean(organizationId || organizationName)')
    expect(inventory).toContain('!organizationsLoading && !organizationsUnavailable')
    expect(inventory).not.toContain('Only an owner or admin of')
    expect(form).toContain('{!canCreate && permissionMessage && <p role=\'status\'')
    expect(submission).toContain('if (!input.canCreate)')
    expect(submission).toContain('input.notify(message, \'error\', \'vm-create\')')
    expect(form).toContain('aria-disabled={!canCreate || undefined}')
    expect(form).toContain('disabled={creating || Boolean(permissionMessage) || unresolvedSetupPrompt}')
})

test('VM creation preserves workspace conflict details from the API', async () => {
    const source = await readFile(createRequest, 'utf8')
    expect(source).toContain('typeof body?.error === \'string\'')
    expect(source).toContain('message: typeof body?.error === \'string\'')
    expect(source).toContain('response.status === 409')
})

test('VM filter popover uses the standard inset and slider-knob icon', async () => {
    const [source, inventory] = await Promise.all([readFile(filters, 'utf8'), readFile(components, 'utf8')])
    expect(inventory).toContain('content-start gap-3 p-2')
    expect(inventory).not.toContain('content-start gap-3 p-2 lg:p-4')
    expect(source).toContain('left: position.mobile ? 8 : undefined')
    expect(source).toContain('right = mobile ? 8 :')
    expect(source).toContain('width: position.mobile ? \'calc(100vw - 16px)\'')
    expect(source).toContain('bg-ui-panel p-2 text-ui-text')
    expect(source).toContain('aria-label={activeCount ? `Filters, ${activeCount} active` : \'Filters\'}')
    expect(source).toContain('<path d=\'M2.5 4.5h15M2.5 10h15M2.5 15.5h15\' />')
    expect(source.match(/<circle cx=/g)).toHaveLength(3)
    expect(source).not.toContain('>Filters</button>')
})

test('OS picker gives the arrow breathing room and keeps a custom listbox', async () => {
    const source = await readFile(new URL('../src/components/profile/vmOptionPicker.tsx', import.meta.url), 'utf8')
    expect(source).toContain('role=\'listbox\'')
    expect(source).toContain('pl-3 pr-4 text-left text-sm text-ui-text')
    expect(source).toContain('h-6 w-6 shrink-0 place-items-center rounded-full border')
    expect(source).toContain('text-[10px] font-semibold uppercase tracking-[0.14em] text-ui-muted')
})
