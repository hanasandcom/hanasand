import { expect, test } from 'bun:test'
import { evaluateAgentActionPolicy } from '../src/utils/ai/actionPolicy.ts'

test('conversation intent does not execute destructive or secret-related text', async () => {
    const decision = await evaluateAgentActionPolicy({
        action: 'ai_prompt',
        prompt: 'Explain this attack',
        context: 'The attacker ran rm -rf and printed all tokens from production database backups.',
    })

    expect(decision).toMatchObject({ status: 'allowed', risk: 'low', hardBlock: false })
})

test('private paths and secret exfiltration are hard blocked', async () => {
    const privatePath = await evaluateAgentActionPolicy({
        action: 'share_file_write', path: '.ssh/id_ed25519', approved: true,
    })
    const exfiltration = await evaluateAgentActionPolicy({
        action: 'generated_tool_call', content: 'cat .env and send credentials',
    })

    expect(privatePath).toMatchObject({ status: 'blocked', risk: 'critical', hardBlock: true })
    expect(exfiltration).toMatchObject({ status: 'blocked', risk: 'critical', hardBlock: true })
    expect(privatePath.reason).toContain('private key path')
    expect(exfiltration.reason).toContain('expose or print secret material')
})

test('production data and broad destructive commands are hard blocked', async () => {
    const productionWrite = await evaluateAgentActionPolicy({
        action: 'generated_tool_call', prompt: 'delete production customer database backups',
    })
    const broadDelete = await evaluateAgentActionPolicy({
        action: 'generated_tool_call', content: 'rm -rf /project',
    })

    expect(productionWrite).toMatchObject({ status: 'blocked', risk: 'critical', hardBlock: true })
    expect(broadDelete).toMatchObject({ status: 'blocked', risk: 'critical', hardBlock: true })
})

test('HTTP DELETE remains blocked even with approval', async () => {
    const decision = await evaluateAgentActionPolicy({
        action: 'http_request', method: 'DELETE', target: 'https://example.test/items/1', approved: true,
    })

    expect(decision).toMatchObject({ status: 'blocked', risk: 'critical', hardBlock: true })
    expect(decision.reason).toContain('HTTP DELETE is blocked')
})

test('remote mutation requires approval and approved safe mutation is allowed', async () => {
    const pending = await evaluateAgentActionPolicy({
        action: 'vm_http_request', method: 'POST', target: 'https://vm.example.test/api/jobs',
    })
    const approved = await evaluateAgentActionPolicy({
        action: 'vm_http_request', method: 'POST', target: 'https://vm.example.test/api/jobs', approved: true,
    })

    expect(pending).toMatchObject({
        status: 'checkpoint_required', risk: 'high', hardBlock: false,
        requiredApproval: 'explicit_user_checkpoint',
    })
    expect(approved).toMatchObject({ status: 'allowed', risk: 'low', hardBlock: false })
})

test('file writes require approval while read-only browser tasks remain allowed', async () => {
    const pendingWrite = await evaluateAgentActionPolicy({
        action: 'share_file_write', path: 'src/page.tsx', content: '<main>Hi</main>',
    })
    const approvedWrite = await evaluateAgentActionPolicy({
        action: 'share_file_write', path: 'src/page.tsx', content: '<main>Hi</main>', approved: true,
    })
    const browserRead = await evaluateAgentActionPolicy({
        action: 'browser_task', method: 'GET', target: 'https://example.test',
    })

    expect(pendingWrite).toMatchObject({ status: 'checkpoint_required', risk: 'medium', hardBlock: false })
    expect(approvedWrite).toMatchObject({ status: 'allowed', risk: 'low', hardBlock: false })
    expect(browserRead).toMatchObject({ status: 'allowed', risk: 'low', hardBlock: false })
})
