import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertDarkThemeSurface } from '../scripts/darkThemeSurfaceAssertions.mjs'

test('dark-theme surface assertion checks required classes across designated sources', () => {
    const violations: string[] = []
    assertDarkThemeSurface({
        source: 'source without banned color',
        requiredClasses: ['bg-ui-canvas', 'text-ui-text'],
        missingClassPrefix: 'surface needs ',
        bannedColorPattern: /#[0-9a-f]{3,6}/gi,
        bannedColorMessage: 'surface contains a one-off color',
        requiredSources: ['bg-ui-canvas', 'text-ui-text'],
    }, violations)

    assert.deepEqual(violations, [])
})

test('dark-theme surface assertion reports missing classes and banned colors', () => {
    const violations: string[] = []
    assertDarkThemeSurface({
        source: 'bg-ui-panel text-[#fff]',
        requiredClasses: ['bg-ui-panel', 'text-ui-text'],
        missingClassPrefix: 'surface needs ',
        bannedColorPattern: /#[0-9a-f]{3,6}/gi,
        bannedColorMessage: 'surface contains a one-off color',
    }, violations)

    assert.deepEqual(violations, [
        'surface needs text-ui-text',
        'surface contains a one-off color',
    ])
})
