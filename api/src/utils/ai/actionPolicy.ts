import { blocked, checkpoint } from './actionPolicyDecisionHelpers.ts'
import { BROAD_DELETE_PATTERN, DESTRUCTIVE_COMMAND_PATTERN, DESTRUCTIVE_METHODS, PRODUCTION_DB_PATTERN, SECRET_COMMAND_PATTERN, SECRET_CONTENT_PATTERN, SECRET_EXFIL_PATTERN, SECRET_PATH_PATTERN } from './actionPolicyRules.ts'
import type { AgentPolicyDecision, AgentPolicyInput } from './actionPolicyTypes.ts'

export { auditAgentAction } from './actionPolicyAudit.ts'
export { redactAgentText } from './actionPolicyRedaction.ts'
export type { AgentPolicyDecision, AgentPolicyInput } from './actionPolicyTypes.ts'

export async function evaluateAgentActionPolicy(input: AgentPolicyInput): Promise<AgentPolicyDecision> {
    // Discussing an operation or extracting evidence does not execute it.
    // Check generated tool calls and actual writes at their action boundaries.
    if (input.action === 'ai_prompt') return {
        status: 'allowed', risk: 'low', hardBlock: false,
        reason: 'Conversation prompts do not execute tools.',
        safeAlternative: 'Evaluate proposed actions separately before execution.',
    }
    const intentHaystack = [
        input.target,
        input.method,
        input.path,
        input.prompt,
        input.context,
        JSON.stringify(input.metadata || {}),
    ].filter(Boolean).join('\n')

    const path = input.path || input.target || ''
    const method = (input.method || '').toUpperCase()

    if (SECRET_PATH_PATTERN.test(path)) {
        return blocked('critical', 'The requested action targets an environment file, SSH key, or private key path.', 'Use a redacted .env.example placeholder or a scoped secret manager reference instead.')
    }

    if (SECRET_EXFIL_PATTERN.test(intentHaystack) || SECRET_COMMAND_PATTERN.test(input.content || '') || SECRET_CONTENT_PATTERN.test(input.content || '')) {
        return blocked('critical', 'The requested action would expose or print secret material.', 'Return only variable names, placeholders, or rotation instructions. Never echo secret values.')
    }

    if (PRODUCTION_DB_PATTERN.test(intentHaystack)) {
        return blocked('critical', 'The requested action appears to write to production data or backups.', 'Use a read-only inspection, staging database, or dry-run migration plan with restore proof.')
    }

    if (BROAD_DELETE_PATTERN.test(intentHaystack) || DESTRUCTIVE_COMMAND_PATTERN.test(input.content || '')) {
        return blocked('critical', 'The requested action is a broad or irreversible delete.', 'Create a checkpoint, list exact targets, and provide a dry-run delete plan instead.')
    }

    if (input.action === 'http_request' || input.action === 'vm_http_request') {
        if (method === 'DELETE') {
            return blocked('critical', 'HTTP DELETE is blocked for agent tools because it can remove data remotely.', 'Use GET/HEAD to inspect state, or create a human-reviewed backend action with rollback evidence.')
        }

        if (DESTRUCTIVE_METHODS.has(method) && !input.approved) {
            return checkpoint('high', `HTTP ${method} can mutate remote state and needs explicit approval.`, 'Run a GET/HEAD dry-run or explain the exact endpoint, payload, rollback, and expected effect before retrying.')
        }
    }

    if (input.action === 'share_file_write') {
        if (!input.approved) {
            return checkpoint('medium', 'File writes require the user-facing pending-change checkpoint before execution.', 'Stage the change for review, show affected files, and let the user apply it explicitly.')
        }
    }

    return {
        status: 'allowed',
        risk: 'low',
        reason: 'Allowed by agent action policy.',
        hardBlock: false,
        safeAlternative: 'Proceed with the scoped action and record the audit entry.',
    }
}
