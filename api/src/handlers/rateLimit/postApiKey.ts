import type { FastifyReply, FastifyRequest } from 'fastify'
import { authorizeRateLimitAdmin } from './authorizeAdmin.ts'
import { createApiKey, normalizeApiKeyTier, validateApiKeyFields, validateApiKeyScopes } from '#utils/auth/apiKeys.ts'

export default async function postApiKeyHandler(req: FastifyRequest, res: FastifyReply) {
    if (!await authorizeRateLimitAdmin(req, res)) return

    const body = (req.body || {}) as Partial<ApiKeySummary> & { scopes?: ApiKeyScopeRule[] }
    const fieldValidation = validateApiKeyFields(body)
    if (!fieldValidation.valid) {
        return res.status(400).send({ error: fieldValidation.error || 'Missing required API key fields.' })
    }

    const scopeValidation = validateApiKeyScopes(body.scopes)
    if (!scopeValidation.valid) {
        return res.status(400).send({ error: scopeValidation.error || 'Invalid API key scopes.' })
    }

    const created = await createApiKey({
        ownerId: String(body.ownerId).trim(),
        name: String(body.name).trim(),
        tier: normalizeApiKeyTier(body.tier),
        description: String(body.description).trim(),
        enabled: body.enabled !== false,
        expiresAt: String(body.expiresAt).trim(),
        scopes: scopeValidation.scopes,
    })

    return res.status(201).send(created)
}
