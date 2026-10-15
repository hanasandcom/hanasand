import run from '#db'
import { decryptRepoSecret, encryptRepoSecret } from './repoCredentialCrypto.ts'

export { decryptRepoSecret, encryptRepoSecret }
export { isRepoSecretEncryptedWithCurrentKey } from './repoCredentialCrypto.ts'

type RepoCredentialRow = {
    github_token_encrypted: string | null
    github_token_hint: string | null
    github_token_attached_at: string | null
    github_token_last_used_at: string | null
    github_token_last_validated_at: string | null
}

export type RepoCredentialSummary = {
    provider: 'github_pat'
    hasCredential: boolean
    tokenHint: string | null
    attachedAt: string | null
    lastUsedAt: string | null
    lastValidatedAt: string | null
}

export function buildTokenHint(token: string) {
    const trimmed = token.trim()
    return trimmed ? `••••${trimmed.slice(-4)}` : null
}

export async function getRepoCredential(repositoryId: string, ownerId: string) {
    const result = await run(`
        SELECT github_token_encrypted, github_token_hint, github_token_attached_at, github_token_last_used_at, github_token_last_validated_at
        FROM ai_imported_repositories
        WHERE id = $1
          AND owner_id = $2
        LIMIT 1
    `, [repositoryId, ownerId])

    const row = (result.rows[0] as RepoCredentialRow | undefined) || null
    if (!row?.github_token_encrypted) {
        return null
    }

    return {
        token: decryptRepoSecret(row.github_token_encrypted),
        summary: toRepoCredentialSummary(row),
    }
}

export async function setRepoCredential(repositoryId: string, ownerId: string, token: string, validated = false) {
    const result = await run(`
        UPDATE ai_imported_repositories
        SET github_token_encrypted = $3,
            github_token_hint = $4,
            github_token_attached_at = NOW(),
            github_token_last_used_at = NOW(),
            github_token_last_validated_at = CASE WHEN $5 THEN NOW() ELSE github_token_last_validated_at END,
            auth_mode = 'github_token',
            auth_hint = 'Private GitHub access is stored server-side for this repository. You can revoke it from the workspace.'
        WHERE id = $1
          AND owner_id = $2
        RETURNING github_token_encrypted, github_token_hint, github_token_attached_at, github_token_last_used_at, github_token_last_validated_at
    `, [repositoryId, ownerId, encryptRepoSecret(token.trim()), buildTokenHint(token), validated])

    const row = (result.rows[0] as RepoCredentialRow | undefined) || null
    if (!row) {
        throw new Error('Repository not found.')
    }

    return toRepoCredentialSummary(row)
}

export async function touchRepoCredentialUsage(repositoryId: string, ownerId: string, validated = false) {
    const result = await run(`
        UPDATE ai_imported_repositories
        SET github_token_last_used_at = NOW(),
            github_token_last_validated_at = CASE WHEN $3 THEN NOW() ELSE github_token_last_validated_at END
        WHERE id = $1
          AND owner_id = $2
          AND github_token_encrypted IS NOT NULL
        RETURNING github_token_encrypted, github_token_hint, github_token_attached_at, github_token_last_used_at, github_token_last_validated_at
    `, [repositoryId, ownerId, validated])

    const row = (result.rows[0] as RepoCredentialRow | undefined) || null
    return row ? toRepoCredentialSummary(row) : null
}

export async function clearRepoCredential(repositoryId: string, ownerId: string) {
    const result = await run(`
        UPDATE ai_imported_repositories
        SET github_token_encrypted = NULL,
            github_token_hint = NULL,
            github_token_attached_at = NULL,
            github_token_last_used_at = NULL,
            github_token_last_validated_at = NULL,
            auth_mode = 'public',
            auth_hint = NULL
        WHERE id = $1
          AND owner_id = $2
        RETURNING id
    `, [repositoryId, ownerId])

    return Boolean(result.rows.length)
}

export function toRepoCredentialSummary(row: RepoCredentialRow | null | undefined): RepoCredentialSummary {
    return {
        provider: 'github_pat',
        hasCredential: Boolean(row?.github_token_encrypted),
        tokenHint: row?.github_token_hint || null,
        attachedAt: row?.github_token_attached_at || null,
        lastUsedAt: row?.github_token_last_used_at || null,
        lastValidatedAt: row?.github_token_last_validated_at || null,
    }
}
