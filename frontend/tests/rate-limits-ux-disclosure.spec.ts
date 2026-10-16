import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('rate limits separates policy from key issuance workflow', async () => {
    const sources = await Promise.all([
        'src/app/dashboard/system/rates/pageClient.tsx',
        'src/app/dashboard/system/rates/RateLimitHeader.tsx',
        'src/app/dashboard/system/rates/ApiKeyCreationForm.tsx',
        'src/app/dashboard/system/rates/ApiKeyCard.tsx',
        'src/app/dashboard/system/rates/model.ts',
        'src/app/dashboard/system/rates/RateLimitFields.tsx',
        'src/app/dashboard/system/rates/useApiKeyDraft.ts',
    ].map((file) => readFile(path.join(root, file), 'utf8')))
    const page = sources.join('\n')

    expect(page).toContain('const [workspace, setWorkspace] = useState<\'keys\' | \'policy\'>(\'keys\')')
    expect(page).toContain('role=\'group\' aria-label=\'Rate-limit workspace\'')
    expect(page).toContain('[\'keys\', \'Keys\']')
    expect(page).toContain('[\'policy\', \'Policy\']')
    expect(page).toContain('workspace === \'policy\'')
    expect(page).toContain('workspace === \'keys\'')
    expect(page).toContain('Add first route')
    expect(page).toContain('Ready to issue')
    expect(page).toContain('disabled={saving || !ready}')
    expect(page).toContain('type=\'date\'')
    expect(page).toContain('Create Key')
    expect(page).toContain('<span>Key settings</span>')
    expect(page).toContain('<span>Allowed routes</span>')
})
