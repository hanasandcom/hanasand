import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

const sources = {
    inventory: new URL('../src/components/profile/vm.tsx', import.meta.url),
    terminal: new URL('../src/components/vms/consoleClient.tsx', import.meta.url),
    connectButton: new URL('../src/components/vms/vmConnectLocally.tsx', import.meta.url),
    sharedDialog: new URL('../src/components/vms/vmSudoPassword.tsx', import.meta.url),
    supportPage: new URL('../src/app/support/page.tsx', import.meta.url),
    supportChat: new URL('../src/components/support/supportChat.tsx', import.meta.url),
    supportConversation: new URL('../src/components/support/supportConversation.tsx', import.meta.url),
}

test('VM inventory and terminal expose the audited sudo-password reveal flow', async () => {
    const [inventory, terminal, dialog] = await Promise.all([
        readFile(sources.inventory, 'utf8'), readFile(sources.terminal, 'utf8'), readFile(sources.sharedDialog, 'utf8'),
    ])

    expect(inventory).toContain('<VMSudoPassword vmName={vm.name} compact triggerClassName=')
    expect(inventory).toContain('data-vm-actions')
    expect(terminal).toContain('<VMSudoPassword vmName={name} compact triggerClassName=')
    expect(inventory).toContain('<VMConnectLocally vmName={vm.name}')
    expect(terminal).toContain('<VMConnectLocally vmName={name}')
    expect(inventory).toContain('sm:hidden')
    expect(terminal).toContain('<Menu aria-hidden')
    expect(dialog).toContain('/sudo-password')
    expect(dialog).toContain('currentPassword: password')
    expect(dialog).toContain('cache: \'no-store\'')
    expect(dialog).toContain('Enter your password so we\'re sure its you.')
    expect(dialog).toMatch(/font-medium'>Password/)
    expect(dialog).toContain('Confirm')
    expect(dialog).toContain('copyTextToClipboard(sudoPassword)')
    expect(dialog).toMatch(/aria-label={copied \? 'Sudo password copied' : 'Copy sudo password'}/)
})

test('local SSH connect action fetches the saved command on demand and provides copy access', async () => {
    const connect = await readFile(sources.connectButton, 'utf8')
    expect(connect).toContain('/api/backend/vm/${encodeURIComponent(vmName)}/connection')
    expect(connect).toContain('cache: \'no-store\'')
    expect(connect).toContain('Run this SSH command in Terminal on your computer. SSH uses port 443.')
    expect(connect).toContain('copyTextToClipboard(command)')
    expect(connect).toContain('aria-label={copied ? \'SSH command copied\' : \'Copy SSH command\'}')
})

test('unavailable password support link opens a prefilled ticket that can be created directly', async () => {
    const [dialog, supportPage, supportChat, supportConversation] = await Promise.all([
        readFile(sources.sharedDialog, 'utf8'), readFile(sources.supportPage, 'utf8'),
        readFile(sources.supportChat, 'utf8'), readFile(sources.supportConversation, 'utf8'),
    ])
    expect(dialog).toContain('Unavailable. Contact Support if the problem persists.')
    expect(dialog).toContain('newTicket: \'vm-sudo-password\'')
    expect(dialog).toContain('Contact Support')
    expect(supportPage).toContain('Sudo password unavailable for ${vmName}')
    expect(supportPage).toContain('newTicketPrefill={newTicketPrefill}')
    expect(supportChat).toContain('newTicketPrefill?.message')
    expect(supportConversation).toContain('selectedId ? \'Send\' : \'Create ticket\'')
})
