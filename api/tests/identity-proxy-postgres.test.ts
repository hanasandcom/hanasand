import { expect, test } from 'bun:test'
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { exportJWK, SignJWT } from 'jose'

const enabled = process.env.RUN_CORE_ORGANIZATION_PROOF_STAGE === '1'
test.skipIf(!enabled)(
    'real Identity111 and PostgreSQL: delegated organization proof, replay and API-owned route protection',
    async () => {
        const stageId = process.env.CORE_ORGANIZATION_PROOF_STAGE_ID || ''
        if (
            !/^[A-Za-z0-9]{6,12}$/.test(stageId) ||
            process.env.DB_HOST !== `core-organization-proof-db-${stageId}` ||
            process.env.DB !== 'core_organization_proof_test' ||
            process.env.DB_USER !== 'synthetic'
        )
            throw new Error('Requires isolated synthetic core-organization-proof database')
        const identityRoot = '/identity'
        const identityDb = await import(`${identityRoot}/src/utils/db.ts`)
        const query = identityDb.default
        const core = Fastify({ trustProxy: ['127.0.0.1', '::1'] })
        let identity: Awaited<ReturnType<typeof Fastify>> | undefined
        let closeCoreDatabase: (() => Promise<void>) | undefined
        try {
            for (const migration of [
                '001_identity.sql',
                '002_identity_admin.sql',
                '003_profile_ssh_key_usage.sql',
                '004_oidc_provider_transactions.sql',
                '005_mobile_sso_codes.sql',
                '006_session_device_proof.sql'
            ])
                await query(await Bun.file(`${identityRoot}/migrations/${migration}`).text())
            await query(
                'INSERT INTO users(id,name,password,avatar,email,email_verified_at) VALUES(\'synthetic-user\',\'Synthetic User\',\'disabled\',\'\',\'synthetic@example.invalid\',NOW())'
            )
            const organizationId = '3e735e7b-4d7f-444d-9806-231fa26cfcec'
            await query(
                'INSERT INTO organizations(id,name,slug,created_by) VALUES($1,\'Synthetic Organization\',\'hanasand\',\'synthetic-user\')',
                [organizationId]
            )
            await query(
                'INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,\'synthetic-user\',\'owner\')',
                [organizationId]
            )
            const nativeKeys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
            const wrongKeys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
            const nativeJwk = await exportJWK(nativeKeys.publicKey)
            const wrongJwk = await exportJWK(wrongKeys.publicKey)
            const identitySession = await import(`${identityRoot}/src/utils/auth/session.ts`)
            const issued = await identitySession.issueToken({
                id: 'synthetic-user',
                ip: '127.0.0.1',
                devicePublicJwk: nativeJwk
            })
            expect(typeof issued.token).toBe('string')
            const { createAuthServer } = await import(`${identityRoot}/src/authServer.ts`)
            identity = createAuthServer()
            const identityAddress = await identity!.listen({ host: '127.0.0.1', port: 0 })
            process.env.HANASAND_IDENTITY_SERVICE_URL = identityAddress
            const { default: limiter } = await import('../src/plugins/rateLimit.ts')
            const { default: proxy } = await import('../src/utils/identityProxy.ts')
            const { identityProxyRouteConfig } = await import('../src/utils/identityProxyPolicy.ts')
            const { getOrganizationApiKeys } = await import('../src/handlers/organizations/apiKeys.ts')
            closeCoreDatabase = (await import('../src/utils/db.ts')).closeDatabase
            await core.register(limiter)
            for (const url of ['/api/organizations', '/api/management/organizations'])
                core.get(url, { config: identityProxyRouteConfig }, proxy)
            core.get('/api/organizations/:id/api-keys', getOrganizationApiKeys)
            const proofCount = async () =>
                Number((await query('SELECT count(*) FROM session_device_proof_jtis')).rows[0].count)
            async function proof(
                path = '/api/organizations',
                key = nativeKeys,
                jwk = nativeJwk,
                method = 'GET'
            ) {
                return new SignJWT({
                    htm: method,
                    htu: `https://api.hanasand.com${path}`,
                    iat: Math.floor(Date.now() / 1000),
                    jti: randomUUID(),
                    ath: createHash('sha256').update(issued.token).digest('base64url')
                })
                    .setProtectedHeader({ typ: 'dpop+jwt', alg: 'ES256', jwk })
                    .sign(key.privateKey)
            }
            const headers = (deviceProof?: string) => ({
                host: 'api.hanasand.com',
                'x-forwarded-proto': 'https',
                authorization: `Bearer ${issued.token}`,
                id: 'synthetic-user',
                ...(deviceProof ? { dpop: deviceProof } : {})
            })
            const firstProof = await proof()
            const first = await core.inject({
                method: 'GET',
                url: '/api/organizations',
                headers: headers(firstProof)
            })
            expect(first.statusCode).toBe(200)
            expect(first.json().organizations[0].id).toBe(organizationId)
            expect(await proofCount()).toBe(1)
            expect(
                (
                    await core.inject({
                        method: 'GET',
                        url: '/api/organizations',
                        headers: headers(firstProof)
                    })
                ).statusCode
            ).toBe(401)
            expect(await proofCount()).toBe(1)
            expect(
                (
                    await core.inject({
                        method: 'GET',
                        url: '/api/organizations',
                        headers: headers(await proof())
                    })
                ).statusCode
            ).toBe(200)
            for (const invalid of [
                undefined,
                await proof('/api/organizations', wrongKeys, wrongJwk),
                await proof('/api/user'),
                await proof('/api/organizations', nativeKeys, nativeJwk, 'POST')
            ])
                expect(
                    (
                        await core.inject({
                            method: 'GET',
                            url: '/api/organizations',
                            headers: headers(invalid)
                        })
                    ).statusCode
                ).toBe(401)
            expect((await core.inject({ method: 'GET', url: '/api/organizations' })).statusCode).toBe(401)
            expect(
                (
                    await core.inject({
                        method: 'GET',
                        url: '/api/management/organizations',
                        headers: headers(await proof('/api/management/organizations'))
                    })
                ).statusCode
            ).toBe(200)
            const ownedPath = `/api/organizations/${organizationId}/api-keys`
            expect(
                (
                    await core.inject({
                        method: 'GET',
                        url: ownedPath,
                        headers: {
                            ...headers(),
                            'authentication-owner': 'identity',
                            'x-hanasand-session-validated': '1'
                        }
                    })
                ).statusCode
            ).toBe(401)
            const ownedProof = await proof(ownedPath)
            expect(
                (await core.inject({ method: 'GET', url: ownedPath, headers: headers(ownedProof) }))
                    .statusCode
            ).toBe(200)
            expect(
                (await core.inject({ method: 'GET', url: ownedPath, headers: headers(ownedProof) }))
                    .statusCode
            ).toBe(401)
            const counters = (
                await query(
                    'SELECT bucket_key,request_count FROM api_rate_limit_buckets WHERE bucket_key IN (\'ip:127.0.0.1:global:anonymous\',\'user:synthetic-user:global:internal\')'
                )
            ).rows
            expect(counters).toHaveLength(2)
            expect(counters.every((row: { request_count: number }) => row.request_count > 0)).toBe(true)
            await query(`UPDATE api_rate_limit_buckets SET request_count=6000,
            window_started_at=to_timestamp(floor(extract(epoch FROM NOW())/60)*60)
            WHERE bucket_key='user:synthetic-user:global:internal'`)
            expect(
                (
                    await core.inject({
                        method: 'GET',
                        url: '/api/organizations',
                        headers: headers(await proof())
                    })
                ).statusCode
            ).toBe(429)
            await query(`UPDATE api_rate_limit_buckets SET request_count=90,
            window_started_at=to_timestamp(floor(extract(epoch FROM NOW())/60)*60)
            WHERE bucket_key='ip:127.0.0.1:global:anonymous'`)
            const beforeCoreLimit = await proofCount()
            expect(
                (
                    await core.inject({
                        method: 'GET',
                        url: '/api/organizations',
                        headers: headers(await proof())
                    })
                ).statusCode
            ).toBe(429)
            expect(await proofCount()).toBe(beforeCoreLimit)
        } finally {
            await core.close()
            await identity?.close()
            await closeCoreDatabase?.()
            await identityDb.closeDatabase()
        }
    },
    30000
)
