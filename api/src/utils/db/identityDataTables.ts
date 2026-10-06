export const identityDataTables = [
    'users', 'tokens', 'login_events', 'attempts', 'password_reset_codes',
    'password_reset_security_actions', 'passkey_challenges', 'user_passkeys',
    'social_auth_transactions', 'user_social_identities', 'roles', 'user_roles',
    'organizations', 'organization_members', 'organization_invites', 'api_keys',
    'api_key_scopes',
    'signup_verifications', 'mail_accounts', 'impersonation_sessions',
    'impersonation_events', 'system_events', 'system_event_acknowledgments',
    'certificates', 'user_certificates', 'host_ssh_keys', 'organization_watchlist_items',
    'organization_privacy_requests', 'admin_access_recovery_approvals',
] as const

export const identityDataPrimaryKeys = {
    users: ['id'], organizations: ['id'], roles: ['id'], tokens: ['token_id'],
    login_events: ['id'], attempts: ['id'], password_reset_codes: ['id'],
    password_reset_security_actions: ['id'], passkey_challenges: ['id'],
    user_passkeys: ['credential_id'], social_auth_transactions: ['state_hash'],
    user_social_identities: ['provider', 'subject'], user_roles: ['user_id', 'role_id'],
    organization_members: ['organization_id', 'user_id'], organization_invites: ['id'],
    api_keys: ['id'], api_key_scopes: ['id'], signup_verifications: ['id'],
    mail_accounts: ['user_id'], impersonation_sessions: ['id'], impersonation_events: ['id'],
    system_events: ['id'], system_event_acknowledgments: ['event_id'], certificates: ['id'],
    user_certificates: ['user_id', 'certificate_id'], host_ssh_keys: ['id'],
    organization_watchlist_items: ['id'], organization_privacy_requests: ['id'],
    admin_access_recovery_approvals: ['request_id'],
} as const
