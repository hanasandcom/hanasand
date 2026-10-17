import assert from 'node:assert/strict'
import { queryOnce } from '../../src/utils/db.ts'
import { createApiKey, organizationPublicApiScopes, validateApiKey } from '../../src/utils/auth/apiKeys.ts'

export async function seedLifecycleFixtures() {
    await queryOnce(`
    INSERT INTO users (id, name, password, avatar)
    VALUES
        ('commercial-creator', 'Commercial Creator', 'test', ''),
        ('commercial-admin', 'Commercial Admin', 'test', '')
`)
    await queryOnce(`
    INSERT INTO article_ownership (id, owner_id) VALUES ('commercial-creator.md', 'commercial-creator');
    INSERT INTO attempts (id, attempts) VALUES ('commercial-creator', 2);
    INSERT INTO login_events (user_id, ip, user_agent, status, reason)
    VALUES ('commercial-creator', '198.51.100.12', 'Commercial smoke', 'failed', 'bad_password');
    INSERT INTO system_events (event_type, actor_id, object_type, object_id, subject_id, request_id, ip, user_agent, context)
    VALUES ('user.audit', 'commercial-creator', 'user', 'commercial-creator', 'commercial-creator', 'request-creator',
        '198.51.100.12', 'Commercial smoke', '{"targetId":"commercial-creator","targetName":"Commercial Creator"}'::jsonb)
`)
    await queryOnce(`
    INSERT INTO tokens (id, token, ip, user_agent)
    VALUES ('commercial-creator', 'commercial-session-token', '127.0.0.1', 'Commercial smoke')
`)
    await queryOnce(`
    INSERT INTO organizations (id, name, slug, created_by)
    VALUES ('commercial-org', 'Commercial Organization', 'commercial-organization', 'commercial-creator')
`)
    await queryOnce(`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES
        ('commercial-org', 'commercial-creator', 'owner'),
        ('commercial-org', 'commercial-admin', 'admin')
`)
    await queryOnce(`
    INSERT INTO case_repositories (id, owner_id, organization_id, provider, repository_url, secret_encrypted)
    VALUES
        ('11111111-1111-4111-8111-111111111111', 'commercial-creator', 'commercial-org', 'github', 'https://github.com/example/project', 'secret-a'),
        ('22222222-2222-4222-8222-222222222222', 'commercial-admin', 'commercial-org', 'github', 'https://github.com/example/project', 'secret-b')
`)

    const organizationKey = await createApiKey({
        ownerId: 'commercial-creator',
        organizationId: 'commercial-org',
        name: 'Commercial API',
        tier: 'starter',
        expiresAt: '2027-01-01T00:00:00.000Z',
        scopes: organizationPublicApiScopes(),
    })
    const legacyUnboundKey = await createApiKey({
        ownerId: 'commercial-creator',
        name: 'Legacy unbound API key',
        tier: 'custom',
        expiresAt: '2027-01-01T00:00:00.000Z',
        scopes: [organizationPublicApiScopes()[2]],
    })
    assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')
    assert.equal((await validateApiKey(legacyUnboundKey.secret))?.ownerId, 'commercial-creator')


    return { organizationKey, legacyUnboundKey }
}
