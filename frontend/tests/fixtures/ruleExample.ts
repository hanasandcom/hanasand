import type { Rule } from '../../src/app/dashboard/rules/detection-rules'

export const rule: Rule = {
    id: 'http.routine_access.v1',
    version: '1',
    name: 'Routine requests',
    hitCount: 12345,
    family: 'HTTP',
    severity: 'high',
    explanation: 'Count routine requests.',
    evidence: [],
    enabled: true,
    definition: { stage: 'analyze', action: 'drop' },
}
