import type { FastifyReply, FastifyRequest } from 'fastify'
import { authorizeRateLimitAdmin } from './authorizeAdmin.ts'
import { normalizeApiKeyTier, updateApiKey, validateApiKeyFields, validateApiKeyScopes } from '#utils/auth/apiKeys.ts'

export default async function putApiKeyHandler(req: FastifyRequest, res: FastifyReply) {
    if (!await authorizeRateLimitAdmin(req, res)) return

    const { id } = req.params as { id: string }
    const body = (req.body || {}) as Partial<ApiKeySummary> & { scopes?: ApiKeyScopeRule[] }
    if (!id) {
        return res.status(400).send({ error: 'Missing id.' })
    }

    const fieldValidation = validateApiKeyFields(body)
    if (!fieldValidation.valid) {
        return res.status(400).send({ error: fieldValidation.error || 'Missing required API key fields.' })
    }

    const scopeValidation = validateApiKeyScopes(body.scopes)
    if (!scopeValidation.valid) {
        return res.status(400).send({ error: scopeValidation.error || 'Invalid API key scopes.' })
    }

    const updated = await updateApiKey(id, {
        ownerId: String(body.ownerId).trim(),
        name: String(body.name).trim(),
        tier: normalizeApiKeyTier(body.tier),
        description: String(body.description).trim(),
        enabled: body.enabled !== false,
        expiresAt: String(body.expiresAt).trim(),
        scopes: scopeValidation.scopes,
    })

    if (!updated) {
        return res.status(404).send({ error: 'API key not found.' })
    }

    return res.send({ apiKey: updated })
}
