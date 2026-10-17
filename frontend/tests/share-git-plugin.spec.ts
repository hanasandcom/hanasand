import { readFileSync } from 'node:fs'
import { expect, test } from 'bun:test'

const metadataSource = readFileSync(new URL('../src/components/share/metadata.tsx', import.meta.url), 'utf8')

test('metadata parent routes the selected Git panel to GitPlugin', () => {
    const gitPanel = metadataSource.match(/\{activePanel === 'git' \? \([\s\S]*?\) : null\}/)?.[0]

    // SSR starts on the workspace tab; the panel switch itself is covered by the sidebar runtime test.
    expect(gitPanel).toContain('<GitPlugin shareRouteId={shareRouteId} share={share} />')
})
