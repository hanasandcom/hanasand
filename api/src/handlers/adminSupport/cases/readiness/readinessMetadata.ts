export const supportReadinessReceiptSchemas = [
    'support.readiness_export.v1',
    'support.recovery.readiness_matrix.v1',
    'support.recovery.case_replay_fixture.v1',
    'support.recovery.lifecycle_cleanup_export.v1',
    'support.readiness.case_timeline_export.v1',
    'support.case.timeline_entry.v1',
    'support.workbench.readiness_proof.v1',
    'support.inspection.enterprise_readiness.v1',
    'support.inspection.replay_export_packet.v1',
    'support.member_recovery.handoff_receipt.v1',
    'support.access_recovery.decision_receipt.v1',
    'support.impersonation.lifecycle_receipt.v1',
    'support.audit.filter_contract.v1',
    'support.audit.export_proof.v1',
]

export const supportReadinessDenialCases = [
    'support_role_required',
    'missing_support_reason',
    'non_support_actor',
    'wrong_org_scope',
    'support_session_revoked',
    'support_session_expired',
    'support_session_scope_denied',
    'denied_recovery_approval',
    'duplicate_invite_or_idempotency_key',
    'audit_unavailable',
    'redaction_required',
]

export const supportReadinessProductMetadata = {
    expectedDashboardRowId: 'helpdesk_audit',
    backendProofContractVersion: 'support.readiness_export.v1',
    integrationProbeHint: 'GET /api/admin/support/readiness must return readiness.schemaVersion=support.readiness_export.v1 and redacted audit replay filters.',
    focusedCheck: 'cd api && bun scripts/smoke-admin-support-contract.ts',
}
