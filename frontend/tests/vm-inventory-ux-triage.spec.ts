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
    expect(vmRow).toContain('className={`${vmActionStyle} max-sm:hidden px-3 text-ui-text`}')
    expect(vmRow).toContain('triggerClassName={`${vmActionStyle} max-sm:hidden px-3 text-ui-primary`}')

    expect(vmRow).toContain('data-vm-actions')
    expect(vmRow).toContain('More actions')
    expect(vmRow).toContain('className={`${vmActionStyle} w-full justify-start px-3 text-ui-text sm:hidden`}')
    expect(vmRow).toContain('triggerClassName={`${vmActionStyle} w-full justify-start px-3 text-ui-primary sm:hidden`}')
    expect(vmRow).toContain('<AddToOrganization vm={vm} onAdded={update} onFeedback={onFeedback} />')
    expect(vmRow).toContain('Delete VM')
    expect(vmRow).toContain('deleteVM(vm.name, confirmation)')
    expect(vmRow.indexOf('data-vm-danger-actions')).toBeLessThan(vmRow.indexOf('Delete VM'))

    expect(vmRow).not.toContain('useKeyPress')
    expect(vmRow).not.toContain('keys[\'shift\']')
    expect(vmRow).not.toContain('select-none hover:border-ui-danger')
    expect(vmRow).not.toContain('onClick={handleClick}')
})
