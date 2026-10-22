export const authStatusCode = `CASE
    WHEN reason = 'bad_password' THEN 401
    WHEN reason = 'deactivated' THEN 403
    WHEN reason = 'rate_limited' THEN 429
    WHEN reason IN ('unknown_user', 'deleted') THEN 404
    WHEN reason = 'session_issue_failed' THEN 503
    WHEN reason = 'unexpected_error' THEN 500
    ELSE 400
END`

export function expectedHttpProbePredicate(metadata = 'metadata') {
    return `(
        ${metadata}->>'user_agent' = 'hanasand_internal'
        AND NULLIF(${metadata}->>'status_code', '')::int IN (401, 404)
        AND (
            ${metadata}->>'path' = '/api/docker'
            OR ${metadata}->>'path' = '/api/stats'
            OR ${metadata}->>'path' ~ '^/api/vm/[^/]+/start$'
        )
    )`
}

export function expectedTrafficProbePredicate() {
    return `(
        user_agent = 'hanasand_internal'
        AND status IN (401, 404)
        AND (
            path = '/api/docker'
            OR path = '/api/stats'
            OR path ~ '^/api/vm/[^/]+/start$'
        )
    )`
}
