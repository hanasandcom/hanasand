import { strict as assert } from 'node:assert'
import test from 'node:test'
import { isTerminalCredentials, lifecycleFromTerminalUpdate, statusFromTerminalUpdate } from '../src/hooks/terminalMessageState'

test('terminal status shows the last useful update and hides host-resolution noise', () => {
    const message = JSON.stringify({ content: '[+] Preparing SSH access\r\nsudo: unable to resolve host vm-1\r\n[+] Terminal ready' })
    assert.equal(statusFromTerminalUpdate(message), 'Terminal ready')
    assert.equal(statusFromTerminalUpdate(JSON.stringify({ code: 0, content: 'command output' })), null)
    assert.equal(statusFromTerminalUpdate('  legacy status  '), 'legacy status')
})

test('terminal lifecycle recognizes startup, ready, idle, shutdown, and errors', () => {
    const lifecycle = (content: string) => lifecycleFromTerminalUpdate(JSON.stringify({ content }))
    assert.equal(lifecycle('Starting existing VM'), 'waking')
    assert.equal(lifecycle('Preparing SSH access'), 'preparing')
    assert.equal(lifecycle('VM agent is ready'), 'ready')
    assert.equal(lifecycle('Terminal idle'), 'idle')
    assert.equal(lifecycle('VM shutting down'), 'shutting_down')
    assert.equal(lifecycle('[!] VM error'), 'error')
    assert.equal(lifecycle('sudo: unable to resolve host vm-1'), null)
})

test('terminal credentials require every connection field to be a string', () => {
    assert.equal(isTerminalCredentials({ username: 'user', password: 'secret', sshCommand: 'ssh user@host', domain: 'host' }), true)
    assert.equal(isTerminalCredentials({ username: 'user', password: 'secret', sshCommand: 'ssh user@host' }), false)
    assert.equal(isTerminalCredentials(null), false)
})
