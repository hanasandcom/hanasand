import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

test('dashboard mail mounts the shared workspace and calls the dedicated Mail API', async () => {
    const [page, workspace, adapter, client] = await Promise.all([
        readFile(new URL('../src/app/dashboard/mail/page.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/mail/mailWorkspace.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/mail/mailUiApi.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/utils/mail/client.transport.ts', import.meta.url), 'utf8'),
    ])

    expect(page).toContain('<MailWorkspace')
    expect(page).not.toContain('<iframe')
    expect(workspace).toContain("from '@hanasand/mail-ui'")
    expect(workspace).toContain('<SharedMailWorkspace')
    expect(adapter).toContain('satisfies MailUiApi')
    expect(client).toContain('https://mail.hanasand.com/api')
    expect(client).not.toContain('config.url.api')
})
