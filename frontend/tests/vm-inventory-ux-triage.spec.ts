import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('vm inventory exposes explicit safe and destructive actions', async () => {
    const vmRow = await readFile(path.join(root, 'src/components/profile/vm.tsx'), 'utf8')

    expect(vmRow).toContain('data-vm-primary-action')
    expect(vmRow).toContain('Open details')
    expect(vmRow).toContain('router.push(`/vm/${vm.name}`)')
    expect(vmRow).toContain('<RestartButtons vm={vm} onFeedback={onFeedback} showLabels />')
    expect(vmRow).toContain('grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:justify-between')
    expect(vmRow).toContain('title={name} className=\'min-w-0 max-w-full truncate text-base font-semibold text-ui-text\'')
    expect(vmRow).toContain('bg-ui-canvas px-2.5 py-1.5 text-xs\'>VM</span>')
    expect(vmRow).toContain('<RestartButtons vm={vm} onFeedback={onFeedback} showLabels />')
    expect(vmRow).toContain('className={`${vmActionStyle} w-auto px-2.5 text-ui-primary`}')
    expect(vmRow).toContain('className={`${vmActionStyle} px-2.5 text-ui-primary`}')

    expect(vmRow).toContain('More actions')
    expect(vmRow).toContain('className={`${vmActionStyle} w-full justify-start px-3 text-ui-text`}')
    expect(vmRow).toContain('triggerClassName={`${vmActionStyle} w-full justify-start px-3 text-ui-primary`}')
    const menuStart = vmRow.indexOf('<FloatingActionMenu')
    const menuEnd = vmRow.indexOf('</FloatingActionMenu>', menuStart)
    const menu = vmRow.slice(menuStart, menuEnd)
    expect(menuStart).toBeGreaterThan(-1)
    expect(menu).toContain('<VMConnectLocally')
    expect(menu).toContain('<VMSudoPassword')
    expect(menu).not.toContain('<RestartButtons')
    expect(menu).not.toContain('Open details')
    expect(vmRow.indexOf('<RestartButtons vm={vm} onFeedback={onFeedback} showLabels />')).toBeGreaterThan(menuEnd)
    expect(vmRow.indexOf('Open details')).toBeGreaterThan(menuEnd)
    expect(vmRow).toContain('col-span-2 row-start-2 flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 sm:col-auto sm:row-auto sm:order-1')
    expect(vmRow).toContain('<AddToOrganization vm={vm} onAdded={update} onFeedback={onFeedback} />')
    expect(vmRow).toContain('Delete VM')
    expect(vmRow).toContain('deleteVM(vm.name, confirmation)')
    expect(vmRow).toContain('<FloatingActionMenu')
    expect(vmRow).toContain('data-vm-menu-keep-open')
    expect(vmRow.indexOf('<FloatingActionMenu')).toBeLessThan(vmRow.indexOf('Delete VM'))

    expect(vmRow).not.toContain('useKeyPress')
    expect(vmRow).not.toContain('keys[\'shift\']')
    expect(vmRow).not.toContain('select-none hover:border-ui-danger')
    expect(vmRow).not.toContain('onClick={handleClick}')
})
