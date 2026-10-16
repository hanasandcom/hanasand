import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AgentAutomation, AutomationPayload } from '../src/utils/automations/client'
import { newAutomationDraft, toAutomationDraft, validateAutomationDraft } from '../src/app/dashboard/automation/automationDraft'

const validDraft = (overrides: Partial<AutomationPayload> = {}): AutomationPayload => ({
    ...newAutomationDraft('health'),
    targetUrl: 'example.test/health',
    ...overrides,
})

test('draft defaults preserve health and personal automation behavior', () => {
    const health = newAutomationDraft('health')
    assert.equal(health.name, 'Website health check')
    assert.equal(health.actionType, 'agent_prompt')
    assert.equal(health.notifyOn, 'failure')
    assert.equal(health.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

    const cron = newAutomationDraft('cron')
    assert.equal(cron.name, 'Scheduled reminder')
    assert.equal(cron.prompt, '')
    assert.equal(cron.actionType, 'system_alert')
    assert.equal(cron.notifyOn, 'always')
})

test('editing converts monitoring URLs and retains notification destination fallback', () => {
    const automation = {
        name: 'Website', prompt: 'Monitor it', targetUrl: 'example.test/health', monitoringType: 'fetch',
        followRedirects: true, expectedDown: false, upsideDown: false, timeoutSeconds: 0, retryCount: null,
        scheduleKind: 'interval', intervalMinutes: 0, status: 'active', actionType: 'agent_prompt',
        modelName: 'discord-hook', notificationDestinations: null, notifyOn: null, notifyWarnings: false,
    } as unknown as AgentAutomation

    const draft = toAutomationDraft(automation)
    assert.equal(draft.targetUrl, 'https://example.test/health')
    assert.equal(draft.timeoutSeconds, 1)
    assert.equal(draft.retryCount, 1)
    assert.equal(draft.intervalMinutes, 15)
    assert.deepEqual(draft.notificationDestinations, ['discord-hook'])
    assert.equal(draft.notifyOn, 'failure')
})

test('draft validation enforces monitoring and schedule contracts', () => {
    assert.equal(validateAutomationDraft(validDraft()), null)
    assert.equal(validateAutomationDraft(validDraft({ name: '  ' }))?.field, 'name')
    assert.equal(validateAutomationDraft(validDraft({ targetUrl: '' }))?.field, 'url')
    assert.equal(validateAutomationDraft(validDraft({ monitoringType: 'tcp', targetUrl: 'bad:host' }))?.field, 'url')
    assert.equal(validateAutomationDraft(validDraft({ monitoringType: 'push', targetUrl: 'system:reserved', actionType: 'agent_prompt' }))?.field, 'url')
    assert.equal(validateAutomationDraft(validDraft({ monitoringType: 'json', jsonRule: { path: 'nested..field', operator: 'gt', value: 2, aggregate: 'max' } }))?.field, 'json')
    assert.equal(validateAutomationDraft(validDraft({ scheduleKind: 'interval', intervalMinutes: 43201 }))?.field, 'schedule')
    assert.equal(validateAutomationDraft(validDraft({ scheduleKind: 'once', runAt: new Date(Date.now() - 60_000).toISOString() }))?.field, 'schedule')
    assert.equal(validateAutomationDraft(validDraft({ prompt: '  ' }))?.field, 'prompt')
})

test('system metrics JSON and push monitoring retain their special valid cases', () => {
    assert.equal(validateAutomationDraft(validDraft({ monitoringType: 'json', targetUrl: 'system:metrics', jsonRule: { path: 'host.load', operator: 'gt', value: 2, aggregate: 'max' } })), null)
    assert.equal(validateAutomationDraft(validDraft({ monitoringType: 'push', targetUrl: 'home-1/basement/moisture' })), null)
    assert.equal(validateAutomationDraft(validDraft({ monitoringType: 'tcp', targetUrl: 'git.hanasand.com:22' })), null)
    assert.equal(validateAutomationDraft(validDraft({ scheduleKind: 'once', runAt: new Date(Date.now() + 60_000).toISOString() })), null)
})
