import { afterAll, expect, mock, test } from 'bun:test'
import pg from 'pg'

const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
const namespace = `account_purge_${process.pid}_${Date.now()}`
const pool = port ? new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres_filter_test', options: `-c search_path=${namespace}` }) : null
const query = (sql: string, values?: unknown[]) => {
    if (!pool) throw new Error('Set POSTGRES_FILTER_TEST_PORT to the disposable local PostgreSQL port.')
    return pool.query(sql, values)
}
const transaction = async (work: (tx: typeof query) => Promise<unknown>) => {
    if (!pool) throw new Error('Set POSTGRES_FILTER_TEST_PORT to the disposable local PostgreSQL port.')
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const result = await work((sql, values) => client.query(sql, values))
        await client.query('COMMIT')
        return result
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

let failMailDeletion = false
const revokedUsers: string[] = []
const deletedMailUsers: string[] = []
const purgedSshUsers: string[] = []
mock.module('#db', () => ({
    default: query,
    identityQueryOnce: query,
    withTransaction: transaction,
    tryWithDatabaseAdvisoryLock: async (key: string, work: () => Promise<unknown>) => {
        if (!pool) throw new Error('Set POSTGRES_FILTER_TEST_PORT to the disposable local PostgreSQL port.')
        const client = await pool.connect()
        let acquired = false
        try {
            acquired = (await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [key])).rows[0].locked
            if (!acquired) return { acquired: false }
            return { acquired: true, result: await work() }
        } finally {
            if (acquired) await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [key]).catch(() => {})
            client.release()
        }
    },
}))
mock.module('../src/utils/auth/session.ts', () => ({ revokeAllTokens: async ({ userId }: { userId: string }) => { revokedUsers.push(userId); return 1 } }))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({ deleteMailPrincipal: async (username: string) => {
    deletedMailUsers.push(username)
    if (failMailDeletion) throw new Error('mail provider unavailable')
} }))
mock.module('../src/utils/auth/purgeUserSshKeys.ts', () => ({ purgeUserSshKeys: async (userId: string) => { purgedSshUsers.push(userId); return 0 } }))

const { purgeDeletedAccounts } = await import('../src/utils/auth/purgeDeletedAccounts.ts')

afterAll(async () => {
    if (!pool) return
    await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
    await pool.end()
})

test.skipIf(!port)('purges only due accounts and retries provider failures', async () => {
    await query(`CREATE SCHEMA ${namespace}`)
    await query('CREATE SEQUENCE account_deletion_purge_attempt_order_seq')
    await query(`CREATE TABLE users(id text PRIMARY KEY,name text,email text,active boolean DEFAULT true,reserved boolean DEFAULT false,deletion_scheduled_at timestamptz);
        CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW());
        CREATE TABLE organization_members(organization_id text,user_id text,role text,status text);
        CREATE TABLE api_keys(organization_id text,owner_id text,enabled boolean,expires_at timestamptz);
        CREATE TABLE mail_accounts(user_id text,mail_username text);
        CREATE TABLE tokens(id text,token text);
        CREATE TABLE account_deletion_purge_attempts(
            user_id text PRIMARY KEY,
            attempt_order bigint NOT NULL DEFAULT nextval('account_deletion_purge_attempt_order_seq')
        );
        CREATE TABLE article_ownership(article_id text,owner_id text);
        CREATE TABLE articles(id text PRIMARY KEY,body text NOT NULL);
        CREATE TABLE share(id text PRIMARY KEY,organization_id text,owner text NOT NULL,parent text);
        CREATE TABLE case_repositories(id text PRIMARY KEY,owner_id text,organization_id text);
        CREATE TABLE login_events(user_id text,token_id integer,ip text,user_agent text,status text);
        CREATE TABLE attempts(id text);
        CREATE TABLE system_events(id bigint PRIMARY KEY,object_type text,actor_id text,object_id text,subject_id text,
            request_id text,ip text,user_agent text,context jsonb NOT NULL DEFAULT '{}');`)
    await query(`INSERT INTO users(id,name,email,deletion_scheduled_at) VALUES
        ('due-user','Due User','due@example.test',NOW()-INTERVAL '1 second'),
        ('future-user','Future User','future@example.test',NOW()+INTERVAL '1 day');
        INSERT INTO organizations(id,name,status) VALUES('retained-org','Retained Org','active');
        INSERT INTO organization_members(organization_id,user_id,role,status) VALUES('retained-org','due-user','member','active');
        INSERT INTO mail_accounts(user_id,mail_username) VALUES('due-user','due-mail');
        INSERT INTO tokens(id,token) VALUES('due-user','due-token'),('future-user','future-token');
        INSERT INTO articles(id,body) VALUES('public-article','Public article remains');
        INSERT INTO article_ownership(article_id,owner_id) VALUES('public-article','due-user');
        INSERT INTO share(id,organization_id,owner,parent) VALUES
            ('personal-root',NULL,'due-user',''),('personal-child',NULL,'other-user','personal-root'),
            ('organization-share','retained-org','due-user','');
        INSERT INTO case_repositories(id,owner_id,organization_id) VALUES
            ('personal-repository','due-user',NULL),('organization-repository','due-user','retained-org');
        INSERT INTO api_keys(organization_id,owner_id,enabled,expires_at) VALUES
            (NULL,'due-user',TRUE,NULL),('retained-org','due-user',TRUE,NULL);
        INSERT INTO login_events(user_id,token_id,ip,user_agent,status) VALUES
            ('due-user',1,'192.0.2.10','deleted browser','success'),('future-user',2,'192.0.2.11','future browser','success');
        INSERT INTO attempts(id) VALUES('due-user'),('future-user');
        INSERT INTO system_events(id,object_type,actor_id,object_id,subject_id,request_id,ip,user_agent,context)
            VALUES(1,'user','due-user','due-user','due-user','request','192.0.2.10','deleted browser',
                '{"targetId":"due-user","targetName":"Due User","reason":"account closed"}'),
                (2,'account_notice',NULL,NULL,NULL,'legacy-request','192.0.2.12','legacy browser',
                '{"targetName":"Due User","reason":"name only"}'),
                (3,'account_notice',NULL,NULL,NULL,'legacy-email-request','192.0.2.13','legacy email browser',
                '{"userEmail":"due@example.test","reason":"email only"}'),
                (4,'unrelated_event',NULL,NULL,NULL,'free-text-request','192.0.2.14','unrelated browser',
                '{"reason":"Due User"}');`)

    failMailDeletion = true
    await expect(purgeDeletedAccounts()).rejects.toThrow('1 due account deletion cleanup(s) failed')
    expect((await query('SELECT id FROM users ORDER BY id')).rows).toEqual([{ id: 'due-user' }, { id: 'future-user' }])
    expect((await query('SELECT user_id FROM account_deletion_purge_attempts')).rows).toEqual([{ user_id: 'due-user' }])

    failMailDeletion = false
    await query(`INSERT INTO users(id,name,email,deletion_scheduled_at)
        SELECT 'fresh-due-' || series, 'Fresh Due User', 'fresh-' || series || '@example.test', NOW()-INTERVAL '1 day'
        FROM generate_series(1,25) AS series`)
    expect(await purgeDeletedAccounts()).toMatchObject({ scanned: 25, purged: 25, failed: 0 })
    expect((await query('SELECT id FROM users WHERE id = \'due-user\'')).rows).toEqual([])
    expect((await query('SELECT COUNT(*)::int AS count FROM users WHERE id LIKE \'fresh-due-%\'')).rows[0].count).toBe(1)
    expect((await query('SELECT id FROM users WHERE id = \'future-user\'')).rows).toEqual([{ id: 'future-user' }])
    expect((await query('SELECT token FROM tokens')).rows).toEqual([{ token: 'future-token' }])
    expect((await query('SELECT body FROM articles WHERE id=\'public-article\'')).rows).toEqual([{ body: 'Public article remains' }])
    expect((await query('SELECT * FROM article_ownership')).rows).toHaveLength(0)
    expect((await query('SELECT id FROM share')).rows).toEqual([{ id: 'organization-share' }])
    expect((await query('SELECT owner FROM share WHERE id=\'organization-share\'')).rows[0].owner).toBe('')
    expect((await query('SELECT id,owner_id FROM case_repositories')).rows).toEqual([{ id: 'organization-repository', owner_id: null }])
    expect((await query('SELECT organization_id,owner_id FROM api_keys')).rows).toEqual([{ organization_id: 'retained-org', owner_id: null }])
    expect((await query('SELECT user_id FROM login_events')).rows).toEqual([{ user_id: 'future-user' }])
    expect((await query('SELECT id FROM attempts')).rows).toEqual([{ id: 'future-user' }])
    expect((await query('SELECT object_id,subject_id,request_id,ip,user_agent,context FROM system_events WHERE id=1')).rows[0]).toMatchObject({
        object_id: null, subject_id: null, request_id: '', ip: '', user_agent: '', context: { reason: 'account closed' },
    })
    expect((await query('SELECT request_id,ip,user_agent,context FROM system_events WHERE id=2')).rows[0]).toMatchObject({
        request_id: '', ip: '', user_agent: '', context: { reason: 'name only' },
    })
    expect((await query('SELECT request_id,ip,user_agent,context FROM system_events WHERE id=3')).rows[0]).toMatchObject({
        request_id: '', ip: '', user_agent: '', context: { reason: 'email only' },
    })
    expect((await query('SELECT request_id,ip,user_agent,context FROM system_events WHERE id=4')).rows[0]).toMatchObject({
        request_id: 'free-text-request', ip: '192.0.2.14', user_agent: 'unrelated browser', context: { reason: 'Due User' },
    })
    expect((await query('SELECT user_id FROM account_deletion_purge_attempts')).rows).toHaveLength(0)
    expect(revokedUsers).toHaveLength(26)
    expect(revokedUsers.filter(userId => userId === 'due-user')).toHaveLength(2)
    expect(deletedMailUsers).toEqual(['due-mail', 'due-mail'])
    expect(purgedSshUsers).toHaveLength(26)
    expect(purgedSshUsers.filter(userId => userId === 'due-user')).toHaveLength(2)
    expect(await purgeDeletedAccounts()).toMatchObject({ scanned: 1, purged: 1, failed: 0 })

    await query(`INSERT INTO users(id,name,email,deletion_scheduled_at)
        SELECT 'retry-user-' || series, 'Retry User', 'retry-' || series || '@example.test', NOW()-INTERVAL '2 days'
        FROM generate_series(1,30) AS series;
        INSERT INTO mail_accounts(user_id,mail_username)
        SELECT 'retry-user-' || series, 'retry-mail-' || series
        FROM generate_series(1,30) AS series;
        INSERT INTO account_deletion_purge_attempts(user_id,attempt_order)
        SELECT 'retry-user-' || series, nextval('account_deletion_purge_attempt_order_seq')
        FROM generate_series(1,30) AS series;
        INSERT INTO users(id,name,email,deletion_scheduled_at)
        SELECT 'new-due-' || series, 'New Due User', 'new-' || series || '@example.test', NOW()-INTERVAL '1 hour'
        FROM generate_series(1,30) AS series`)
    failMailDeletion = true
    const firstRetryCall = deletedMailUsers.length
    await expect(purgeDeletedAccounts()).rejects.toThrow('12 due account deletion cleanup(s) failed')
    const firstRetryBatch = deletedMailUsers.slice(firstRetryCall)
    expect(firstRetryBatch).toHaveLength(12)
    expect(new Set(firstRetryBatch).size).toBe(12)
    expect((await query('SELECT COUNT(*)::int AS count FROM users WHERE id LIKE \'new-due-%\'')).rows[0].count).toBe(17)

    const secondRetryCall = deletedMailUsers.length
    await expect(purgeDeletedAccounts()).rejects.toThrow('12 due account deletion cleanup(s) failed')
    const secondRetryBatch = deletedMailUsers.slice(secondRetryCall)
    expect(secondRetryBatch).toHaveLength(12)
    expect(new Set(secondRetryBatch).size).toBe(12)
    expect(firstRetryBatch.some(username => secondRetryBatch.includes(username))).toBe(false)
    expect((await query('SELECT COUNT(*)::int AS count FROM users WHERE id LIKE \'new-due-%\'')).rows[0].count).toBe(4)

    failMailDeletion = false
    while ((await query('SELECT COUNT(*)::int AS count FROM users WHERE id LIKE \'retry-user-%\' OR id LIKE \'new-due-%\'')).rows[0].count > 0) {
        await purgeDeletedAccounts()
    }
    expect((await query('SELECT COUNT(*)::int AS count FROM account_deletion_purge_attempts')).rows[0].count).toBe(0)
})
