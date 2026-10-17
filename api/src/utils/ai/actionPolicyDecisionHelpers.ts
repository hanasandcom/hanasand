import type { AgentPolicyDecision } from './actionPolicyTypes.ts'

export function blocked(risk: AgentPolicyDecision['risk'], reason: string, safeAlternative: string): AgentPolicyDecision {
    return {
        status: 'blocked',
        risk,
        reason,
        hardBlock: true,
        safeAlternative,
    }
}

export function checkpoint(risk: AgentPolicyDecision['risk'], reason: string, safeAlternative: string): AgentPolicyDecision {
    return {
        status: 'checkpoint_required',
        risk,
        reason,
        hardBlock: false,
        safeAlternative,
        requiredApproval: 'explicit_user_checkpoint',
    }
}
