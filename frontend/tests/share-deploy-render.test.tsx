// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { createElement, type SetStateAction } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ShareRuntimeCapability } from '../src/utils/share/runtimeCapabilities'

const { default: Deploy } = await import('../src/components/share/deploy')

function capability(overrides: Partial<ShareRuntimeCapability> = {}): ShareRuntimeCapability {
    return {
        hasHttpSurface: true,
        canDeploy: true,
        canPreview: true,
        reason: 'Detected Dockerfile, port 3000, server code.',
        port: '3000',
        evidence: ['Dockerfile', 'port 3000', 'server code'],
        ...overrides,
    }
}

function render(cap: ShareRuntimeCapability, terminalOpen = false) {
    return renderToStaticMarkup(createElement(Deploy, {
        capability: cap,
        terminalOpen,
        setTerminalOpen() {},
    }))
}

test('deployment control follows runtime capability and exposes its actual rendered states', () => {
    expect(render(capability({ hasHttpSurface: false }))).toBe('')

    const unavailable = render(capability({ canDeploy: false, reason: 'No deployable runtime was detected.' }))
    expect(unavailable).toContain('Deployment unavailable')
    expect(unavailable).toContain('Deploy unavailable')
    expect(unavailable).toContain('aria-label="Deployment unavailable: No deployable runtime was detected."')
    expect(unavailable).toContain('disabled=""')
    expect(unavailable).toContain('No deployable runtime was detected.')

    const available = render(capability())
    expect(available).toContain('aria-label="Open deployment path with logs and rollback"')
    expect(available).toContain('Detected Dockerfile, port 3000...')
    expect(available).toContain('Health')
    expect(available).toContain('Logs')
    expect(available).toContain('Rollback')
    expect(available).toContain('rounded-lg border p-3')
    expect(available).toContain('shadow-lg')
    expect(available).not.toMatch(/\brounded-(?:xl|2xl|3xl)\b/)
    expect(available).not.toMatch(/\bshadow-\[/)
    expect(available).not.toMatch(/\b(?:bg|text|border)-\[#/)
    expect(render(capability(), true)).toContain('aria-label="Deployment path is open"')
    expect(render(capability(), true)).toContain('Deployment open')
})

test('deployment action opens only when the runtime can deploy', () => {
    let open = false
    const setTerminalOpen = (value: SetStateAction<boolean>) => {
        open = typeof value === 'function' ? value(open) : value
    }
    const available = Deploy({ capability: capability(), terminalOpen: false, setTerminalOpen })
    available?.props.onClick()
    expect(open).toBe(true)

    open = false
    const unavailable = Deploy({ capability: capability({ canDeploy: false }), terminalOpen: false, setTerminalOpen })
    unavailable?.props.onClick()
    expect(open).toBe(false)
})
