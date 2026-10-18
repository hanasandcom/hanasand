import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertDarkThemeSurface } from '../scripts/darkThemeSurfaceAssertions.mjs'

test('dark-theme surface assertion checks required classes across designated sources', () => {
    const violations: string[] = []
    assertDarkThemeSurface(
        'source without banned color',
        ['bg-ui-canvas', 'text-ui-text'],
        'surface needs ',
        /#[0-9a-f]{3,6}/gi,
        'surface contains a one-off color',
        violations,
        ['bg-ui-canvas', 'text-ui-text'],
    )

    assert.deepEqual(violations, [])
})

test('dark-theme surface assertion reports missing classes and banned colors', () => {
    const violations: string[] = []
    assertDarkThemeSurface(
        'bg-ui-panel text-[#fff]',
        ['bg-ui-panel', 'text-ui-text'],
        'surface needs ',
        /#[0-9a-f]{3,6}/gi,
        'surface contains a one-off color',
        violations,
    )

    assert.deepEqual(violations, [
        'surface needs text-ui-text',
        'surface contains a one-off color',
    ])
})
